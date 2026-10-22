package br.com.atlas;
import com.fasterxml.jackson.databind.*;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.support.TransactionTemplate;
import java.net.*;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
@Service
public class SurveillanceService {
 static final List<String> SOURCES=List.of("gho","infodengue","sinan");
 static final Map<String,String> INDICATORS=Map.of("WHS3_62","Sarampo","WHS3_43","Coqueluche","WHS3_41","Difteria");
 record City(String code,String name,String state,double latitude,double longitude){}
 static final List<City> CITIES=List.of(new City("3550308","São Paulo","SP",-23.5505,-46.6333),new City("3304557","Rio de Janeiro","RJ",-22.9068,-43.1729),new City("3106200","Belo Horizonte","MG",-19.9167,-43.9345),new City("4106902","Curitiba","PR",-25.4284,-49.2733),new City("2304400","Fortaleza","CE",-3.7319,-38.5267),new City("5300108","Brasília","DF",-15.7939,-47.8828));
 final ObservationRepository observations;final FeedRepository feeds;final HttpClient client;final ObjectMapper mapper;final TransactionTemplate transaction;
 final ExecutorService worker=Executors.newSingleThreadExecutor(r->{Thread t=new Thread(r,"atlas-official-sources");t.setDaemon(true);return t;});
 final Set<String> pending=ConcurrentHashMap.newKeySet();
 public SurveillanceService(ObservationRepository o,FeedRepository f,HttpClient c,ObjectMapper m,TransactionTemplate t){observations=o;feeds=f;client=c;mapper=m;transaction=t;}
 synchronized FeedState state(String id){if(!SOURCES.contains(id))throw new IllegalArgumentException("Invalid source");return feeds.findById(id).orElseGet(()->{FeedState s=new FeedState();s.id=id;s.enabled=true;return feeds.save(s);});}
 public List<Map<String,Object>> status(){return SOURCES.stream().map(id->{FeedState s=state(id);Map<String,Object> m=new LinkedHashMap<>();m.put("id",id);m.put("enabled",s.enabled);m.put("lastAttempt",s.lastAttempt);m.put("lastSuccess",s.lastSuccess);m.put("failed",s.failed);m.put("detail",s.detail);m.put("running",pending.contains(id));m.put("records",observations.countBySource(id));return m;}).toList();}
 public synchronized void enable(String id,boolean enabled){FeedState s=state(id);s.enabled=enabled;feeds.save(s);}
 public boolean enqueue(String id){state(id);if(!pending.add(id))return false;worker.submit(()->{try{refresh(id);}finally{pending.remove(id);}});return true;}
 @PreDestroy void stop(){worker.shutdownNow();}
 @Scheduled(initialDelayString="${atlas.feeds.initial-delay:10000}",fixedDelay=60000)
 public void scheduled(){for(String id:SOURCES){FeedState s=state(id);long interval=s.failed?1800:id.equals("gho")?86400:43200;if(s.enabled&&(s.lastAttempt==null||s.lastAttempt.plusSeconds(interval).isBefore(Instant.now())))enqueue(id);}}
 void refresh(String id){FeedState s=state(id);s.lastAttempt=Instant.now();feeds.save(s);try{
   List<SurveillanceObservation> batch=switch(id){case "gho"->gho();case "infodengue"->infoDengue();default->sinan();};
   if(batch.isEmpty())throw new IllegalStateException("no-data");
   transaction.executeWithoutResult(tx->observations.saveAllAndFlush(batch));
   s.lastSuccess=Instant.now();s.failed=false;s.detail="ok";
  }catch(InterruptedException e){Thread.currentThread().interrupt();s.failed=true;s.detail="interrupted";}catch(Exception e){s.failed=true;s.detail=id.equals("sinan")?"sinan-unavailable":"source-unavailable";}
  s.enabled=state(id).enabled;feeds.save(s);
 }
 JsonNode get(String url) throws Exception {
  HttpRequest req=HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(18)).header("Accept","application/json").GET().build();
  HttpResponse<java.io.InputStream> res=client.send(req,HttpResponse.BodyHandlers.ofInputStream());
  try(var stream=res.body()){if(res.statusCode()!=200)throw new IllegalStateException("source-unavailable");byte[] bytes=stream.readNBytes(8000001);if(bytes.length>8000000)throw new IllegalStateException("response-too-large");return mapper.readTree(bytes);}
 }
 List<SurveillanceObservation> gho() throws Exception {
  JsonNode countries;try(var input=getClass().getResourceAsStream("/country-locations.json")){countries=mapper.readTree(input);}
  List<SurveillanceObservation> batch=new ArrayList<>();int year=LocalDate.now(ZoneOffset.UTC).getYear();
  for(var indicator:INDICATORS.entrySet()){
   String url="https://ghoapi.azureedge.net/api/"+indicator.getKey()+"?$filter=SpatialDimType%20eq%20%27COUNTRY%27%20and%20TimeDim%20ge%20"+(year-3)+"&$top=1000";
   int pages=0;do{if(++pages>10)throw new IllegalStateException("pagination-limit");JsonNode root=get(url);batch.addAll(parseGho(root,countries,indicator.getKey(),indicator.getValue(),year));url=root.path("@odata.nextLink").asText("");if(!url.isEmpty()&&!url.startsWith("https://ghoapi.azureedge.net/api/"+indicator.getKey()+"?"))throw new IllegalStateException("unexpected-pagination");}while(!url.isEmpty());
  }return batch;
 }
 static List<SurveillanceObservation> parseGho(JsonNode root,JsonNode countries,String indicator,String disease,int currentYear){
  JsonNode values=root.path("value");if(!values.isArray())throw new IllegalArgumentException("Invalid GHO response");List<SurveillanceObservation> result=new ArrayList<>();Set<String> seen=new HashSet<>();
  for(JsonNode n:values){
   if(!n.path("SpatialDimType").asText().equals("COUNTRY")||!n.path("IndicatorCode").asText().equals(indicator)||!n.path("TimeDimType").asText().equals("YEAR"))continue;
   if(List.of("Dim1","Dim2","Dim3").stream().anyMatch(d->!n.path(d).isNull()&&!n.path(d).isMissingNode()))continue;
   JsonNode place=countries.path(n.path("SpatialDim").asText());if(place.isMissingNode()||n.path("NumericValue").isNull())continue;
   if(!n.path("TimeDim").isInt())throw new IllegalArgumentException("Invalid year");int year=n.path("TimeDim").asInt();if(year<1900||year>=currentYear)continue;
   SurveillanceObservation r=new SurveillanceObservation();r.id="gho:"+indicator+":"+n.path("SpatialDim").asText()+":"+year;
   r.source="gho";r.country=place.path("name").asText();r.state="";r.city="Total nacional";r.virus=disease;r.latitude=place.path("latitude").asDouble();r.longitude=place.path("longitude").asDouble();r.cases=count(n.path("NumericValue"));r.periodStart=LocalDate.of(year,1,1);r.periodEnd=LocalDate.of(year,12,31);r.granularity="year";r.fetchedAt=Instant.now();r.sourceUrl="https://ghoapi.azureedge.net/api/"+indicator;
   if(!seen.add(r.id))throw new IllegalArgumentException("Duplicate GHO dimensions");result.add(r);
  }return result;
 }
 List<SurveillanceObservation> infoDengue() throws Exception {
  List<SurveillanceObservation> result=new ArrayList<>();int year=LocalDate.now(ZoneOffset.UTC).getYear();
  for(City city:CITIES)for(String disease:List.of("dengue","chikungunya","zika")){
   String url="https://info.dengue.mat.br/api/alertcity?geocode="+city.code()+"&disease="+disease+"&format=json&ew_start=1&ew_end=53&ey_start="+(year-1)+"&ey_end="+year;
   result.addAll(parseInfo(get(url),city,disease,url));
  }return result;
 }
 static List<SurveillanceObservation> parseInfo(JsonNode data,City city,String disease,String url){
  if(!data.isArray())throw new IllegalArgumentException("Invalid InfoDengue response");List<SurveillanceObservation> result=new ArrayList<>();Set<String> seen=new HashSet<>();
  for(JsonNode n:data){if(n.path("Localidade_id").asInt(-1)!=0)continue;
   LocalDate date=n.path("data_iniSE").isIntegralNumber()?Instant.ofEpochMilli(n.path("data_iniSE").asLong()).atZone(ZoneOffset.UTC).toLocalDate():LocalDate.parse(n.path("data_iniSE").asText());if(date.isAfter(LocalDate.now(ZoneOffset.UTC)))continue;
   SurveillanceObservation r=new SurveillanceObservation();r.id="infodengue:"+city.code()+":"+disease+":"+date;r.source="infodengue";r.country="Brasil";r.state=city.state();r.city=city.name();r.virus=switch(disease){case "dengue"->"Dengue";case "zika"->"Zika";default->"Chikungunya";};r.latitude=city.latitude();r.longitude=city.longitude();r.cases=count(n.path("casos"));r.periodStart=date;r.periodEnd=date.plusDays(6);r.granularity="week";r.preliminary=true;r.fetchedAt=Instant.now();r.sourceUrl=url;
   if(!seen.add(r.id))throw new IllegalArgumentException("Duplicate InfoDengue week");result.add(r);
  }return result;
 }
 static long count(JsonNode n){if(!n.isNumber())throw new IllegalArgumentException("Missing count");try{long value=n.decimalValue().longValueExact();if(value<0||value>9007199254740991L)throw new IllegalArgumentException("Invalid count");return value;}catch(ArithmeticException e){throw new IllegalArgumentException("Fractional count");}}
 List<SurveillanceObservation> sinan() throws Exception {
  // Connectivity monitor only: the ministry API could not be reached to validate its
  // aggregation/pagination contract. Never publish partial line lists as case totals.
  get("https://apidadosabertos.saude.gov.br/v1/");
  throw new IllegalStateException("sinan-unavailable");
 }
}
