package br.com.atlas;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
public class NewsItem {

    @Id
    public String id;

    @Column(nullable = false, length = 1000)
    public String title;

    @Column(nullable = false, length = 1500)
    public String url;

    public Instant publishedAt;
    public String source = "OMS / WHO";
}
