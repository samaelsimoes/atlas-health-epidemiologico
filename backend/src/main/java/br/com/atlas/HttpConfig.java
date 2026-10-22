package br.com.atlas;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.context.annotation.*;

@Configuration
public class HttpConfig {

    @Bean
    public HttpClient sourceClient() {
        return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    }
}
