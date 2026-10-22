package br.com.atlas;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ObservationRepository extends JpaRepository<SurveillanceObservation, String> {
    List<SurveillanceObservation> findBySource(String source);
    long countBySource(String source);
}
