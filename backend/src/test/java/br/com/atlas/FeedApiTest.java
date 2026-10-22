package br.com.atlas;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {
        "spring.datasource.url=jdbc:h2:mem:feed-tests;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "atlas.feeds.initial-delay=3600000",
    }
)
@AutoConfigureMockMvc
class FeedApiTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper mapper;

    @Autowired
    FeedService service;

    @Autowired
    NewsRepository news;

    @Autowired
    RecordRepository records;

    @Autowired
    FeedRepository feeds;

    @Autowired
    org.springframework.transaction.support.TransactionTemplate transaction;

    String item(String path) {
        return (
            "{\"value\":[{\"Id\":\"eafb07ec-9187-4b39-b310-94b99a89571a\",\"Title\":\"Test bulletin\",\"PublicationDate\":\"2026-01-01T00:00:00Z\",\"ItemDefaultUrl\":\"" +
            path +
            "\"}]}"
        );
    }

    @Test
    void parsesOfficialLinksAndRejectsExternalOrMalformedContent() throws Exception {
        var rows = FeedService.parse(mapper.readTree(item("/2026-DON620")));
        assertEquals(
            "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON620",
            rows.get(0).url
        );
        for (String path : new String[] {
            "https://example.com",
            "//example.com",
            "/../elsewhere",
        }) assertThrows(
            IllegalArgumentException.class,
            () -> FeedService.parse(mapper.readTree(item(path)))
        );
        assertThrows(
            IllegalArgumentException.class,
            () -> FeedService.parse(mapper.readTree("{\"value\":[]}"))
        );
    }

    @Test
    void publicNewsDoesNotPublishCountsAndDeduplicates() throws Exception {
        var rows = FeedService.parse(mapper.readTree(item("/2026-DON620")));
        news.saveAll(rows);
        news.saveAll(rows);
        assertEquals(1, news.count());
        assertEquals(0, records.count());
        mvc
            .perform(get("/api/news"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].source").value("OMS / WHO"));
    }

    @Test
    void settingsRequireOwnerAndCsrfAndPersist() throws Exception {
        mvc.perform(get("/api/feeds")).andExpect(status().isUnauthorized());
        mvc
            .perform(
                put("/api/feeds")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"who\":false,\"covid\":true}")
            )
            .andExpect(status().isUnauthorized());
        mvc
            .perform(
                put("/api/feeds")
                    .with(user("owner").roles("ADMIN"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}")
            )
            .andExpect(status().isForbidden());
        mvc
            .perform(
                put("/api/feeds")
                    .with(user("owner").roles("ADMIN"))
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"who\":false,\"covid\":true}")
            )
            .andExpect(status().isOk());
        assertFalse(service.status().get(0).enabled);
        assertTrue(service.status().get(1).enabled);
        mvc
            .perform(post("/api/feeds/news/refresh").with(csrf()))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void failedRefreshRetainsNewsAndSuccessTimestamp() throws Exception {
        news.saveAll(FeedService.parse(mapper.readTree(item("/2026-DON620"))));
        FeedState before = new FeedState();
        before.id = "who";
        before.enabled = true;
        before.lastSuccess = java.time.Instant.parse("2026-01-01T00:00:00Z");
        feeds.save(before);
        java.net.http.HttpClient bad = org.mockito.Mockito.mock(java.net.http.HttpClient.class);
        org.mockito.Mockito
            .when(
                bad.send(
                    org.mockito.ArgumentMatchers.any(),
                    org.mockito.ArgumentMatchers.<
                        java.net.http.HttpResponse.BodyHandler<String>
                    >any()
                )
            )
            .thenThrow(new java.io.IOException("offline"));
        FeedService isolated = new FeedService(
            news,
            feeds,
            bad,
            mapper,
            transaction,
            org.mockito.Mockito.mock(RecordController.class)
        );
        assertFalse(isolated.refreshNews());
        assertEquals(1, news.count());
        assertEquals(before.lastSuccess, feeds.findById("who").orElseThrow().lastSuccess);
        assertTrue(feeds.findById("who").orElseThrow().failed);
    }

    @Test
    void schedulerHonorsEnablementAndInterval() {
        feeds.deleteAll();
        RecordController importer = org.mockito.Mockito.mock(RecordController.class);
        FeedService isolated = new FeedService(
            news,
            feeds,
            org.mockito.Mockito.mock(java.net.http.HttpClient.class),
            mapper,
            transaction,
            importer
        );
        isolated.configure(false, false);
        isolated.scheduled();
        org.mockito.Mockito.verifyNoInteractions(importer);
        isolated.configure(false, true);
        isolated.scheduled();
        isolated.scheduled();
        org.mockito.Mockito.verify(importer, org.mockito.Mockito.times(1)).importCovid();
        assertNotNull(feeds.findById("covid").orElseThrow().lastSuccess);
    }
}
