package br.com.atlas;

import com.fasterxml.jackson.databind.*;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class FeedService {

    static final String WHO =
        "https://www.who.int/api/emergencies/diseaseoutbreaknews?$top=30&$orderby=PublicationDate%20desc&$select=Id,Title,PublicationDate,ItemDefaultUrl";
    private final NewsRepository news;
    private final FeedRepository states;
    private final HttpClient client;
    private final ObjectMapper mapper;
    private final TransactionTemplate transaction;
    private final RecordController records;

    public FeedService(
        NewsRepository news,
        FeedRepository states,
        HttpClient client,
        ObjectMapper mapper,
        TransactionTemplate transaction,
        RecordController records
    ) {
        this.news = news;
        this.states = states;
        this.client = client;
        this.mapper = mapper;
        this.transaction = transaction;
        this.records = records;
    }

    private FeedState state(String id) {
        return states
            .findById(id)
            .orElseGet(() -> {
                FeedState s = new FeedState();
                s.id = id;
                s.enabled = id.equals("who");
                return states.save(s);
            });
    }

    public synchronized List<FeedState> status() {
        return List.of(state("who"), state("covid"));
    }

    public synchronized List<FeedState> configure(boolean who, boolean covid) {
        FeedState w = state("who"), c = state("covid");
        w.enabled = who;
        c.enabled = covid;
        states.saveAll(List.of(w, c));
        return status();
    }

    @Scheduled(initialDelayString = "${atlas.feeds.initial-delay:10000}", fixedDelay = 60000)
    public synchronized void scheduled() {
        for (String id : List.of("who", "covid")) {
            FeedState s = state(id);
            long seconds = id.equals("who") ? 1800 : 21600;
            if (
                s.enabled &&
                (s.lastAttempt == null ||
                    s.lastAttempt.plusSeconds(s.failed ? 1800 : seconds).isBefore(Instant.now()))
            ) refresh(id);
        }
    }

    public synchronized boolean refreshNews() {
        return refresh("who");
    }

    private boolean refresh(String id) {
        FeedState s = state(id);
        s.lastAttempt = Instant.now();
        states.save(s);
        try {
            if (id.equals("who")) {
                HttpRequest req = HttpRequest
                    .newBuilder(URI.create(WHO))
                    .timeout(Duration.ofSeconds(18))
                    .header("Accept", "application/json")
                    .GET()
                    .build();
                HttpResponse<String> response = client.send(
                    req,
                    HttpResponse.BodyHandlers.ofString()
                );
                if (
                    response.statusCode() != 200 || response.body().length() > 2000000
                ) throw new IllegalStateException();
                List<NewsItem> items = parse(mapper.readTree(response.body()));
                transaction.executeWithoutResult(tx -> news.saveAllAndFlush(items));
            } else records.importCovid();
            s.lastSuccess = Instant.now();
            s.failed = false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            s.failed = true;
        } catch (Exception e) {
            s.failed = true;
        }
        states.save(s);
        return !s.failed;
    }

    static List<NewsItem> parse(JsonNode root) {
        JsonNode values = root.path("value");
        if (!values.isArray() || values.isEmpty()) throw new IllegalArgumentException(
            "Invalid WHO response"
        );
        List<NewsItem> result = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (JsonNode n : values) {
            String id = n.path("Id").asText(), title = n.path("Title").asText(), path = n
                .path("ItemDefaultUrl")
                .asText();
            UUID.fromString(id);
            if (
                !ids.add(id) ||
                title.isBlank() ||
                title.length() > 1000 ||
                !path.matches("/[a-zA-Z0-9_/-]+") ||
                path.contains("..") ||
                path.startsWith("//")
            ) throw new IllegalArgumentException("Invalid WHO item");
            NewsItem item = new NewsItem();
            item.id = id;
            item.title = title;
            item.url = "https://www.who.int/emergencies/disease-outbreak-news/item" + path;
            item.publishedAt = Instant.parse(n.path("PublicationDate").asText());
            if (
                item.publishedAt.isAfter(Instant.now().plusSeconds(86400))
            ) throw new IllegalArgumentException("Future publication");
            result.add(item);
        }
        return result;
    }
}
