package br.com.atlas;

import com.fasterxml.jackson.databind.*;
import jakarta.validation.Valid;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class RecordController {

    private final RecordRepository repository;
    private final ObjectMapper mapper;
    private final TransactionTemplate transaction;
    private final HttpClient client;

    public RecordController(
        RecordRepository repository,
        ObjectMapper mapper,
        TransactionTemplate transaction,
        HttpClient client
    ) {
        this.repository = repository;
        this.mapper = mapper;
        this.transaction = transaction;
        this.client = client;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/records")
    public List<HealthRecord> list() {
        return repository.findAll();
    }

    @PostMapping("/records")
    @ResponseStatus(HttpStatus.CREATED)
    public HealthRecord create(@Valid @RequestBody RecordInput input) {
        HealthRecord r = RecordFactory.from(input, "Cadastro manual");
        if (
            repository.existsByCountryIgnoreCaseAndStateIgnoreCaseAndCityIgnoreCaseAndVirusIgnoreCaseAndDateAndSource(
                r.country,
                r.state,
                r.city,
                r.virus,
                r.date,
                r.source
            )
        ) throw new ResponseStatusException(
            HttpStatus.CONFLICT,
            "Já existe um registro deste local, doença e data."
        );
        return repository.save(r);
    }

    @DeleteMapping("/records/{id}")
    public Map<String, Boolean> delete(@PathVariable String id) {
        if (!repository.existsById(id)) throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "Registro não encontrado."
        );
        repository.deleteById(id);
        return Map.of("deleted", true);
    }

    @PostMapping("/imports/covid")
    public Map<String, Object> importCovid() {
        List<HealthRecord> imported = new ArrayList<>();
        try {
            HttpRequest request = HttpRequest
                .newBuilder(URI.create("https://disease.sh/v3/covid-19/countries"))
                .timeout(Duration.ofSeconds(18))
                .header("Accept", "application/json")
                .GET()
                .build();
            HttpResponse<String> response = client.send(
                request,
                HttpResponse.BodyHandlers.ofString()
            );
            if (response.statusCode() != 200) throw new IllegalStateException("Fonte indisponível");
            JsonNode data = mapper.readTree(response.body());
            if (!data.isArray() || data.isEmpty()) throw new IllegalStateException(
                "Resposta vazia ou inválida"
            );
            for (JsonNode n : data) {
                JsonNode info = n.path("countryInfo");
                if (
                    !n.path("country").isTextual() ||
                    n.path("country").asText().isBlank() ||
                    !info.path("lat").isNumber() ||
                    !info.path("long").isNumber() ||
                    !n.path("updated").isIntegralNumber() ||
                    n.path("updated").asLong() <= 0
                ) throw new IllegalStateException("Local ou data inválida");
                for (String field : List.of("cases", "recovered", "deaths")) if (
                    !n.path(field).isIntegralNumber() ||
                    n.path(field).asLong() < 0 ||
                    n.path(field).asLong() > 9007199254740991L
                ) throw new IllegalStateException("Contagem inválida");
                HealthRecord r = new HealthRecord();
                r.country = n.path("country").asText();
                r.city = "Total nacional";
                r.virus = "COVID-19";
                r.latitude = info.path("lat").asDouble();
                r.longitude = info.path("long").asDouble();
                r.cases = n.path("cases").asLong();
                r.recovered = n.path("recovered").asLong();
                r.deaths = n.path("deaths").asLong();
                if (
                    !Double.isFinite(r.latitude) ||
                    Math.abs(r.latitude) > 90 ||
                    !Double.isFinite(r.longitude) ||
                    Math.abs(r.longitude) > 180 ||
                    r.recovered > r.cases ||
                    r.deaths > r.cases - r.recovered
                ) throw new IllegalStateException("Totais inconsistentes na fonte");
                r.source = "disease.sh";
                r.sourceUpdatedAt = Instant.ofEpochMilli(n.path("updated").asLong());
                r.date = r.sourceUpdatedAt.atZone(ZoneOffset.UTC).toLocalDate();
                if (
                    r.sourceUpdatedAt.isAfter(Instant.now().plusSeconds(86400))
                ) throw new IllegalStateException("Data futura na fonte");
                imported.add(r);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Importação interrompida. Sua base foi preservada."
            );
        } catch (Exception e) {
            throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "Não foi possível importar a disease.sh: resposta indisponível ou inconsistente. Sua base foi preservada."
            );
        }
        transaction.executeWithoutResult(status -> {
            for (HealthRecord r : imported) {
                repository
                    .findByCountryAndCityAndVirusAndDateAndSource(
                        r.country,
                        r.city,
                        r.virus,
                        r.date,
                        r.source
                    )
                    .ifPresent(old -> r.id = old.id);
                repository.save(r);
            }
        });
        return Map.of("count", imported.size(), "source", "disease.sh");
    }
}
