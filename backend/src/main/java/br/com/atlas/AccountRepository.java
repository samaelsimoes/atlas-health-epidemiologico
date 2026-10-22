package br.com.atlas;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface AccountRepository extends JpaRepository<Account,String> {
 Optional<Account> findByEmail(String email);
}
