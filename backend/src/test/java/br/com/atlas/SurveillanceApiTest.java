package br.com.atlas;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:official-tests;DB_CLOSE_DELAY=-1","spring.jpa.hibernate.ddl-auto=create-drop","atlas.feeds.initial-delay=3600000"})
@AutoConfigureMockMvc
class SurveillanceApiTest {
 @Autowired ObjectMapper mapper;@Autowired MockMvc mvc;@Autowired ObservationRepository observations;@Autowired FeedRepository feeds;@Autowired SurveillanceService service;
 @BeforeEach void clean(){observations.deleteAll();for(String id:SurveillanceService.SOURCES)feeds.deleteById(id);}
 JsonNode gho(String value) throws Exception {return mapper.readTree("{\"value\":[{\"IndicatorCode\":\"WHS3_62\",\"SpatialDimType\":\"COUNTRY\",\"SpatialDim\":\"BRA\",\"TimeDimType\":\"YEAR\",\"TimeDim\":2025,\"NumericValue\":"+value+"}]}");}
 JsonNode countries() throws Exception{return mapper.readTree("{\"BRA\":{\"name\":\"Brazil\",\"latitude\":-15.79,\"longitude\":-47.88}}");}
 @Test void ghoUsesReportedAnnualCountsAndSkipsMissingOrAggregateValues() throws Exception {
  var rows=SurveillanceService.parseGho(gho("12.0"),countries(),"WHS3_62","Sarampo",2026);assertEquals(1,rows.size());assertEquals(12,rows.get(0).cases);assertEquals(LocalDate.of(2025,12,31),rows.get(0).periodEnd);assertEquals("reported",rows.get(0).measure);
  assertTrue(SurveillanceService.parseGho(gho("null"),countries(),"WHS3_62","Sarampo",2026).isEmpty());
  assertEquals(0,SurveillanceService.parseGho(gho("0"),countries(),"WHS3_62","Sarampo",2026).get(0).cases);
  var aggregate=(com.fasterxml.jackson.databind.node.ObjectNode)gho("12");((com.fasterxml.jackson.databind.node.ObjectNode)aggregate.path("value").get(0)).put("SpatialDimType","REGION");assertTrue(SurveillanceService.parseGho(aggregate,countries(),"WHS3_62","Sarampo",2026).isEmpty());
  assertThrows(IllegalArgumentException.class,()->SurveillanceService.parseGho(gho("12.5"),countries(),"WHS3_62","Sarampo",2026));
 }
 @Test void infoDengueUsesNotificationsNotEstimatesAndUpsertsRevisions() throws Exception {
  var city=SurveillanceService.CITIES.get(0);String json="[{\"Localidade_id\":0,\"data_iniSE\":\"2026-01-04\",\"casos\":10,\"casos_est\":25.5}]";
  var first=SurveillanceService.parseInfo(mapper.readTree(json),city,"dengue","https://info.dengue.mat.br/");assertEquals(10,first.get(0).cases);assertTrue(first.get(0).preliminary);assertEquals(LocalDate.of(2026,1,10),first.get(0).periodEnd);observations.saveAll(first);
  observations.saveAll(SurveillanceService.parseInfo(mapper.readTree(json.replace(":10",":15")),city,"dengue","https://info.dengue.mat.br/"));assertEquals(1,observations.count());assertEquals(15,observations.findAll().get(0).cases);
  assertThrows(IllegalArgumentException.class,()->SurveillanceService.parseInfo(mapper.readTree(json.replace(":10",":-1")),city,"dengue","https://info.dengue.mat.br/"));
 }
 @Test void failedSourcePreservesPreviouslyPublishedObservations() throws Exception {
  var isolated=spy(service);doReturn(SurveillanceService.parseGho(gho("12"),countries(),"WHS3_62","Sarampo",2026)).when(isolated).gho();isolated.refresh("gho");var success=feeds.findById("gho").orElseThrow().lastSuccess;
  doThrow(new IllegalArgumentException("bad-response")).when(isolated).gho();isolated.refresh("gho");assertEquals(1,observations.count());assertEquals(success,feeds.findById("gho").orElseThrow().lastSuccess);assertTrue(feeds.findById("gho").orElseThrow().failed);
 }
 @Test void publicCanReadAndOnlyOwnerWithCsrfCanConfigure() throws Exception {
  mvc.perform(get("/api/surveillance")).andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray());
  mvc.perform(get("/api/surveillance?source=arbitrary-url")).andExpect(status().isBadRequest());
  mvc.perform(post("/api/surveillance/gho/refresh").with(csrf())).andExpect(status().isUnauthorized());
  mvc.perform(put("/api/surveillance/gho").with(user("owner").roles("ADMIN")).contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}")).andExpect(status().isForbidden());
  mvc.perform(put("/api/surveillance/gho").with(user("owner").roles("ADMIN")).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"enabled\":false}")).andExpect(status().isOk());assertFalse(feeds.findById("gho").orElseThrow().enabled);
 }
 @Test void schedulerHonorsPauseAndDueTimeWithoutExternalRequests(){
  var isolated=spy(service);for(String id:SurveillanceService.SOURCES){isolated.enable(id,false);doReturn(false).when(isolated).enqueue(id);}isolated.scheduled();verify(isolated,never()).enqueue(anyString());
  isolated.enable("gho",true);isolated.scheduled();verify(isolated).enqueue("gho");FeedState state=feeds.findById("gho").orElseThrow();state.lastAttempt=Instant.now();feeds.save(state);isolated.scheduled();verify(isolated,times(1)).enqueue("gho");
 }
}
