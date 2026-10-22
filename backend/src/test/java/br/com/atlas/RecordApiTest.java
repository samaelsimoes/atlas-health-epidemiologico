package br.com.atlas;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.net.http.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {
        "spring.datasource.url=jdbc:h2:mem:tests;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
    }
)
@AutoConfigureMockMvc
@org.springframework.security.test.context.support.WithMockUser(roles = "ADMIN")
class RecordApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    RecordRepository repository;

    @MockitoBean
    HttpClient client;

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    private String input(long cases, long recovered) {
        return (
            "{\"country\":\"Brasil\",\"city\":\"São Paulo\",\"virus\":\"Teste\",\"latitude\":-23.55,\"longitude\":-46.63,\"cases\":" +
            cases +
            ",\"recovered\":" +
            recovered +
            ",\"deaths\":1,\"date\":\"2026-01-01\"}"
        );
    }

    @Test
    void savesListsAndRejectsDuplicate() throws Exception {
        mvc
            .perform(
                post("/api/records")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input(10, 3))
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.source").value("Cadastro manual"));
        mvc.perform(get("/api/records")).andExpect(jsonPath("$[0].cases").value(10));
        mvc
            .perform(
                post("/api/records")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input(10, 3))
            )
            .andExpect(status().isConflict());
    }

    @Test
    void allowsSameCityInDifferentStates() throws Exception {
        String first = input(10, 3).replace("{", "{\"state\":\"Estado A\",");
        mvc
            .perform(
                post("/api/records")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(first)
            )
            .andExpect(status().isCreated());
        mvc
            .perform(
                post("/api/records")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(first.replace("Estado A", "Estado B"))
            )
            .andExpect(status().isCreated());
    }

    @Test
    void rejectsImpossibleTotals() throws Exception {
        mvc
            .perform(
                post("/api/records")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input(2, 3))
            )
            .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsMissingCoordinates() throws Exception {
        mvc
            .perform(
                post("/api/records")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input(10, 3).replace("\"latitude\":-23.55,", ""))
            )
            .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsFractionalCounts() throws Exception {
        mvc
            .perform(
                post("/api/records")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input(10, 3).replace("\"cases\":10", "\"cases\":10.5"))
            )
            .andExpect(status().isBadRequest());
    }

    @Test
    @SuppressWarnings("unchecked")
    void importReplacesSourceAndPreservesManual() throws Exception {
        mvc
            .perform(
                post("/api/records")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input(10, 3))
            )
            .andExpect(status().isCreated());
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.body())
            .thenReturn(
                "[{\"country\":\"Brasil\",\"countryInfo\":{\"lat\":-14,\"long\":-51},\"cases\":100,\"recovered\":80,\"deaths\":2,\"updated\":1767225600000}]"
            );
        when(client.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
            .thenReturn(response);
        mvc
            .perform(post("/api/imports/covid").with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count").value(1));
        mvc.perform(post("/api/imports/covid").with(csrf())).andExpect(status().isOk());
        assertEquals(2, repository.count());
        when(response.body())
            .thenReturn(
                "[{\"country\":\"Brasil\",\"countryInfo\":{\"lat\":-14,\"long\":-51},\"cases\":120,\"recovered\":90,\"deaths\":2,\"updated\":1767312000000}]"
            );
        mvc.perform(post("/api/imports/covid").with(csrf())).andExpect(status().isOk());
        assertEquals(3, repository.count());
        assertEquals(
            1,
            repository.findAll().stream().filter(r -> r.source.equals("Cadastro manual")).count()
        );
        when(response.body())
            .thenReturn(
                "[{\"country\":\"Brasil\",\"countryInfo\":{\"lat\":0,\"long\":0},\"cases\":100,\"recovered\":null,\"deaths\":2,\"updated\":1767225600000}]"
            );
        mvc.perform(post("/api/imports/covid").with(csrf())).andExpect(status().isBadGateway());
        assertEquals(3, repository.count());
    }

    @Test
    void deletesAndReportsMissing() throws Exception {
        mvc
            .perform(
                post("/api/records")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(input(10, 3))
            )
            .andExpect(status().isCreated());
        String id = repository.findAll().get(0).id;
        mvc.perform(delete("/api/records/" + id).with(csrf())).andExpect(status().isOk());
        mvc.perform(delete("/api/records/" + id).with(csrf())).andExpect(status().isNotFound());
    }
}
