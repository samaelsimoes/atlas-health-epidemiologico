package br.com.atlas;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:auth-tests;DB_CLOSE_DELAY=-1","spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
class AuthApiTest {
 @Autowired MockMvc mvc;
 @Autowired AccountRepository accounts;
 @Autowired PasswordEncoder encoder;
 private static final String PASSWORD="SenhaFicticiaTeste!42";
 private String setup(){return "{\"name\":\"Pessoa de teste\",\"email\":\"teste@example.com\",\"password\":\""+PASSWORD+"\"}";}
 @BeforeEach void clean(){accounts.deleteAll();}
 private void seed(){Account a=new Account();a.name="Pessoa de teste";a.email="teste@example.com";a.passwordHash=encoder.encode(PASSWORD);accounts.save(a);}
 @Test void blocksAnonymousAndRequiresCsrf() throws Exception {
  mvc.perform(get("/api/records")).andExpect(status().isOk());
  mvc.perform(post("/api/records").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
  mvc.perform(post("/api/auth/setup").contentType(MediaType.APPLICATION_JSON).content(setup())).andExpect(status().isForbidden());
  mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andExpect(jsonPath("$.token").isNotEmpty());
 }
 @Test void setupIsOneTimeAndHashesPassword() throws Exception {
  mvc.perform(get("/api/auth/status")).andExpect(jsonPath("$.initialized").value(false));
  mvc.perform(post("/api/auth/setup").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(setup())).andExpect(status().isCreated());
  Account saved=accounts.findAll().get(0);assertNotEquals(PASSWORD,saved.passwordHash);assertTrue(encoder.matches(PASSWORD,saved.passwordHash));
  mvc.perform(post("/api/auth/setup").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(setup())).andExpect(status().isConflict());
  mvc.perform(get("/api/auth/status")).andExpect(jsonPath("$.initialized").value(true));
 }
 @Test void rejectsWeakPassword() throws Exception {
  mvc.perform(post("/api/auth/setup").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(setup().replace(PASSWORD,"curta"))).andExpect(status().isBadRequest());assertEquals(0,accounts.count());
 }
 @Test void authenticatesPersistsSessionAndLogsOut() throws Exception {
  seed();
  var result=mvc.perform(post("/api/auth/login").with(csrf()).param("username","teste@example.com").param("password",PASSWORD)).andExpect(status().isOk()).andReturn();
  MockHttpSession session=(MockHttpSession)result.getRequest().getSession(false);assertNotNull(session);
  mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Pessoa de teste")).andExpect(jsonPath("$.passwordHash").doesNotExist());
  mvc.perform(get("/api/records").session(session)).andExpect(status().isOk());
  mvc.perform(post("/api/imports/covid").session(session)).andExpect(status().isForbidden());
  mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isOk());assertTrue(session.isInvalid());
  mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
  mvc.perform(get("/api/records")).andExpect(status().isOk());
 }
 @Test void rejectsWrongPassword() throws Exception {
  seed();mvc.perform(post("/api/auth/login").with(csrf()).param("username","teste@example.com").param("password","senha-incorreta")).andExpect(status().isUnauthorized());
 }
}
