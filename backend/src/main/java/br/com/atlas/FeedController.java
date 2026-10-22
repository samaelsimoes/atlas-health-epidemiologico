package br.com.atlas;

import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class FeedController {

    private final FeedService service;
    private final NewsRepository news;

    public FeedController(FeedService service, NewsRepository news) {
        this.service = service;
        this.news = news;
    }

    @GetMapping("/news")
    public Map<String, Object> news() {
        return Map.of("items", news.findTop30ByOrderByPublishedAtDesc(), "feeds", service.status());
    }

    @GetMapping("/feeds")
    public List<FeedState> status() {
        return service.status();
    }

    public record Settings(boolean who, boolean covid) {}

    @PutMapping("/feeds")
    public List<FeedState> configure(@RequestBody Settings settings) {
        return service.configure(settings.who(), settings.covid());
    }

    @PostMapping("/feeds/news/refresh")
    public Map<String, Boolean> refresh() {
        return Map.of("success", service.refreshNews());
    }
}
