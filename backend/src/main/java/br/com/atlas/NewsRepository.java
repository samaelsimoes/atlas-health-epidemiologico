package br.com.atlas;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface NewsRepository extends JpaRepository<NewsItem,String> {
 List<NewsItem> findTop30ByOrderByPublishedAtDesc();
}
