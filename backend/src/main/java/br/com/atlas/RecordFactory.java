package br.com.atlas;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
public final class RecordFactory {
 private RecordFactory(){}
 public static HealthRecord from(RecordInput input,String source){
  if(!Double.isFinite(input.latitude())||!Double.isFinite(input.longitude())||input.recovered()>input.cases()||input.deaths()>input.cases()-input.recovered())throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Recuperados e óbitos não podem superar os confirmados. Confira também as coordenadas.");
  HealthRecord r=new HealthRecord();r.country=input.country().trim();r.state=input.state()==null?"":input.state().trim();r.city=input.city().trim();r.virus=input.virus().trim();r.classification=input.classification()==null?"Doença":input.classification();r.latitude=input.latitude();r.longitude=input.longitude();r.cases=input.cases();r.recovered=input.recovered();r.deaths=input.deaths();r.date=input.date();r.source=source;return r;
 }
}
