package br.com.atlas;
import org.springframework.context.annotation.*;
import java.net.http.HttpClient;
import java.time.Duration;
@Configuration
public class HttpConfig {
 @Bean public HttpClient sourceClient(){return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();}
}
