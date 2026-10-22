package br.com.atlas;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
public class FeedState {

    @Id
    public String id;

    public boolean enabled;
    public Instant lastAttempt;
    public Instant lastSuccess;
    public boolean failed;

    @Column(length = 1000)
    public String detail;
}
