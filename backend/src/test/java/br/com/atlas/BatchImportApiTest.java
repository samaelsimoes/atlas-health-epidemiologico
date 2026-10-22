package br.com.atlas;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:batch-tests;DB_CLOSE_DELAY=-1","spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
@org.springframework.security.test.context.support.WithMockUser(roles="ADMIN")
class BatchImportApiTest {
 @Autowired MockMvc mvc;
 @Autowired RecordRepository repository;
 @BeforeEach void clean(){repository.deleteAll();}
 private String row(String city){return "{\"country\":\"Brasil\",\"state\":\"São Paulo\",\"city\":\""+city+"\",\"virus\":\"Dengue\",\"classification\":\"Surto\",\"latitude\":-22.9,\"longitude\":-47.0,\"cases\":120,\"recovered\":90,\"deaths\":1,\"date\":\"2026-01-01\"}";}
 private String batch(){return "{\"source\":\"Boletim de teste fictício\",\"records\":["+row("Campinas")+","+row("Santos")+"]}";}
 @Test void previewDoesNotSaveAndPreservesClassification() throws Exception {
  mvc.perform(post("/api/imports/preview").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(batch())).andExpect(status().isOk()).andExpect(jsonPath("$.inserted").value(2)).andExpect(jsonPath("$.records[0].classification").value("Surto"));assertEquals(0,repository.count());
 }
 @Test void publishIsIdempotentAndDoesNotMergeSources() throws Exception {
  mvc.perform(post("/api/imports/json").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(batch())).andExpect(status().isOk()).andExpect(jsonPath("$.inserted").value(2));
  mvc.perform(post("/api/imports/json").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(batch().replace("\"cases\":120","\"cases\":150"))).andExpect(status().isOk()).andExpect(jsonPath("$.updated").value(2));assertEquals(2,repository.count());assertEquals(150,repository.findAll().get(0).cases);
  mvc.perform(post("/api/imports/json").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(batch().replace("Boletim de teste fictício","Outra fonte fictícia"))).andExpect(status().isOk()).andExpect(jsonPath("$.inserted").value(2));assertEquals(4,repository.count());
 }
 @Test void invalidRowDoesNotPartiallySaveBatch() throws Exception {
  String invalid="{\"source\":\"Teste\",\"records\":["+row("Campinas")+","+row("Santos").replace("\"recovered\":90","\"recovered\":999")+"]}";
  mvc.perform(post("/api/imports/json").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(invalid)).andExpect(status().isBadRequest());assertEquals(0,repository.count());
 }
 @Test void rejectsInvalidClassification() throws Exception {
  mvc.perform(post("/api/imports/json").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(batch().replace("Surto","Classificação inventada"))).andExpect(status().isBadRequest());assertEquals(0,repository.count());
 }
 @Test void rejectsDuplicateLocationsInBatch() throws Exception {
  mvc.perform(post("/api/imports/json").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(batch().replace("Santos","Campinas"))).andExpect(status().isBadRequest());assertEquals(0,repository.count());
 }
 @Test void visitorsCanReadButCannotPreviewOrPublish() throws Exception {
  mvc.perform(get("/api/records").with(anonymous())).andExpect(status().isOk());
  for(String path:new String[]{"/api/imports/preview","/api/imports/json"})mvc.perform(post(path).with(anonymous()).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(batch())).andExpect(status().isUnauthorized());
 }
}
