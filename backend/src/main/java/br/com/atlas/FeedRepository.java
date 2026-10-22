package br.com.atlas;
import org.springframework.data.jpa.repository.JpaRepository;
public interface FeedRepository extends JpaRepository<FeedState,String> {}
