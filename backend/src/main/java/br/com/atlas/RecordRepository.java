package br.com.atlas;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
public interface RecordRepository extends JpaRepository<HealthRecord,String> {
 java.util.Optional<HealthRecord> findByCountryIgnoreCaseAndStateIgnoreCaseAndCityIgnoreCaseAndVirusIgnoreCaseAndDateAndSource(String country,String state,String city,String virus,LocalDate date,String source);
 boolean existsByCountryIgnoreCaseAndStateIgnoreCaseAndCityIgnoreCaseAndVirusIgnoreCaseAndDateAndSource(String country,String state,String city,String virus,LocalDate date,String source);
 java.util.Optional<HealthRecord> findByCountryAndCityAndVirusAndDateAndSource(String country,String city,String virus,LocalDate date,String source);
 boolean existsByCountryIgnoreCaseAndCityIgnoreCaseAndVirusIgnoreCaseAndDateAndSource(String country,String city,String virus,LocalDate date,String source);
 void deleteBySource(String source);
}
