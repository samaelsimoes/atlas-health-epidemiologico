package br.com.atlas;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;

/** Contrato de entrada comum para arquivos e futuros adaptadores de APIs. */
@RestController @RequestMapping("/api/imports")
public class BatchImportController {
 public record Batch(@NotBlank @Size(max=120) String source,@NotEmpty @Size(max=2000) List<@NotNull @Valid RecordInput> records){}
 private final RecordRepository repository;private final TransactionTemplate transaction;
 public BatchImportController(RecordRepository repository,TransactionTemplate transaction){this.repository=repository;this.transaction=transaction;}
 private List<HealthRecord> prepare(Batch input){
  String source="Importação: "+input.source().trim();Set<List<String>> identities=new HashSet<>();List<HealthRecord> rows=new ArrayList<>();
  for(int i=0;i<input.records().size();i++){
   HealthRecord r;
   try{r=RecordFactory.from(input.records().get(i),source);}catch(ResponseStatusException e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Registro "+(i+1)+": "+e.getReason());}
   List<String> identity=List.of(r.country.toLowerCase(Locale.ROOT),r.state.toLowerCase(Locale.ROOT),r.city.toLowerCase(Locale.ROOT),r.virus.toLowerCase(Locale.ROOT),r.date.toString());
   if(!identities.add(identity))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Registro "+(i+1)+": local, doença e data duplicados dentro do arquivo.");
   rows.add(r);
  }
  return rows;
 }
 private Optional<HealthRecord> existing(HealthRecord r){return repository.findByCountryIgnoreCaseAndStateIgnoreCaseAndCityIgnoreCaseAndVirusIgnoreCaseAndDateAndSource(r.country,r.state,r.city,r.virus,r.date,r.source);}
 @PostMapping("/preview") public Map<String,Object> preview(@Valid @RequestBody Batch input){
  var rows=prepare(input);long updates=rows.stream().filter(r->existing(r).isPresent()).count();
  return Map.of("count",rows.size(),"inserted",rows.size()-updates,"updated",updates,"source",rows.get(0).source,"records",rows);
 }
 @PostMapping("/json") public Map<String,Object> publish(@Valid @RequestBody Batch input){
  var rows=prepare(input);
  return transaction.execute(status->{
   int inserted=0,updated=0;
   for(HealthRecord r:rows){var old=existing(r);if(old.isPresent()){r.id=old.get().id;updated++;}else inserted++;repository.save(r);}
   repository.flush();return Map.<String,Object>of("count",rows.size(),"inserted",inserted,"updated",updated,"source",rows.get(0).source);
  });
 }
}
