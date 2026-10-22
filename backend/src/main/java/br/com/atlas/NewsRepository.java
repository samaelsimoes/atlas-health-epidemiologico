package br.com.atlas;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NewsRepository extends JpaRepository<NewsItem, String> {
    List<NewsItem> findTop30ByOrderByPublishedAtDesc();
}
