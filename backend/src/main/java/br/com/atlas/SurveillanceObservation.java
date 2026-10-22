package br.com.atlas;

import jakarta.persistence.*;
import java.time.*;

@Entity
public class SurveillanceObservation {

    @Id
    public String id;

    public String source, country, state, city, virus, granularity;
    public double latitude, longitude;
    public long cases;
    public LocalDate periodStart, periodEnd;
    public String measure = "reported";
    public boolean preliminary;
    public Instant fetchedAt;

    @Column(length = 1500)
    public String sourceUrl;
}
