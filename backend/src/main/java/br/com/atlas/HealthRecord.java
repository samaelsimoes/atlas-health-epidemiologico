package br.com.atlas;

import jakarta.persistence.*;
import java.time.*;

@Entity
@Table(
    uniqueConstraints = @UniqueConstraint(
        name = "uk_record_location",
        columnNames = { "country", "state", "city", "virus", "record_date", "source" }
    )
)
public class HealthRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    public String id;

    @Column(nullable = false, length = 120)
    public String country;

    @Column(nullable = false, length = 120, columnDefinition = "varchar(120) default ''")
    public String state = "";

    @Column(nullable = false, length = 120)
    public String city;

    @Column(nullable = false, length = 80)
    public String virus;

    @Column(nullable = false, length = 24, columnDefinition = "varchar(24) default 'Doença'")
    public String classification = "Doença";

    public double latitude;
    public double longitude;
    public long cases;
    public long recovered;
    public long deaths;

    @Column(name = "record_date", nullable = false)
    public LocalDate date;

    @Column(nullable = false)
    public String source;

    public Instant sourceUpdatedAt;
}
