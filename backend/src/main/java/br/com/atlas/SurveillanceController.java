package br.com.atlas;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
@RestController @RequestMapping("/api/surveillance")
public class SurveillanceController {
 private final SurveillanceService service;private final ObservationRepository repository;
 public SurveillanceController(SurveillanceService s,ObservationRepository r){service=s;repository=r;}
 private void check(String source){if(!SurveillanceService.SOURCES.contains(source))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Fonte inválida.");}
 @GetMapping public Map<String,Object> data(@RequestParam(defaultValue="infodengue") String source){check(source);return Map.of("items",repository.findBySource(source),"sources",service.status());}
 public record Setting(boolean enabled){}
 @PutMapping("/{source}") public Map<String,Boolean> configure(@PathVariable String source,@RequestBody Setting input){check(source);service.enable(source,input.enabled());return Map.of("saved",true);}
 @PostMapping("/{source}/refresh") @ResponseStatus(HttpStatus.ACCEPTED) public Map<String,Boolean> refresh(@PathVariable String source){check(source);return Map.of("queued",service.enqueue(source));}
}
