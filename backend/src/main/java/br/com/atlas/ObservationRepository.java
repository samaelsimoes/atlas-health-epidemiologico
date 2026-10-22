package br.com.atlas;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ObservationRepository extends JpaRepository<SurveillanceObservation,String> {
 List<SurveillanceObservation> findBySource(String source);
 long countBySource(String source);
}
