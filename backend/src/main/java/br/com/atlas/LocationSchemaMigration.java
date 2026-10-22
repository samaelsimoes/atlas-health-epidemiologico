package br.com.atlas;

import java.util.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class LocationSchemaMigration implements ApplicationRunner {

    private final JdbcTemplate jdbc;

    public LocationSchemaMigration(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        var names = jdbc.queryForList(
            "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_NAME='HEALTH_RECORD' AND CONSTRAINT_TYPE='UNIQUE'",
            String.class
        );
        for (String name : names) {
            var columns = new HashSet<>(
                jdbc.queryForList(
                    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME='HEALTH_RECORD' AND CONSTRAINT_NAME=?",
                    String.class,
                    name
                )
            );
            if (
                columns.equals(Set.of("COUNTRY", "CITY", "VIRUS", "RECORD_DATE", "SOURCE")) &&
                name.matches("[A-Za-z0-9_]+")
            ) jdbc.execute("ALTER TABLE HEALTH_RECORD DROP CONSTRAINT \"" + name + "\"");
        }
    }
}
