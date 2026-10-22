package br.com.atlas;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

@Configuration
public class SecurityConfig {
 @Bean PasswordEncoder passwordEncoder(){return new BCryptPasswordEncoder(12);}
 @Bean UserDetailsService users(AccountRepository repository){return email->repository.findByEmail(email.trim().toLowerCase(java.util.Locale.ROOT)).map(a->User.withUsername(a.email).password(a.passwordHash).roles("ADMIN").build()).orElseThrow(()->new UsernameNotFoundException("Credenciais inválidas"));}
 @Bean SecurityFilterChain security(HttpSecurity http,LoginThrottle throttle) throws Exception {
  return http
   .authorizeHttpRequests(auth->auth.requestMatchers(org.springframework.http.HttpMethod.GET,"/api/records","/api/news","/api/surveillance").permitAll().requestMatchers("/api/health","/api/auth/csrf","/api/auth/status","/api/auth/setup","/api/auth/login","/error").permitAll().anyRequest().hasRole("ADMIN"))
   .requestCache(cache->cache.disable())
   .exceptionHandling(errors->errors.authenticationEntryPoint((req,res,e)->{res.setStatus(401);res.setContentType("application/json;charset=UTF-8");res.getWriter().write("{\"message\":\"Entre na sua conta para continuar.\"}");}).accessDeniedHandler((req,res,e)->{res.setStatus(403);res.setContentType("application/json;charset=UTF-8");res.getWriter().write("{\"message\":\"Sua sessão de segurança expirou. Atualize a página e tente novamente.\"}");}))
   .formLogin(login->login.loginProcessingUrl("/api/auth/login").successHandler((req,res,a)->{res.setContentType("application/json");res.getWriter().write("{\"authenticated\":true}");}).failureHandler((req,res,e)->{res.setStatus(401);res.setContentType("application/json;charset=UTF-8");res.getWriter().write("{\"message\":\"E-mail ou senha inválidos.\"}");}))
   .logout(logout->logout.logoutRequestMatcher(new AntPathRequestMatcher("/api/auth/logout","POST")).invalidateHttpSession(true).deleteCookies("JSESSIONID").logoutSuccessHandler((req,res,a)->{res.setContentType("application/json");res.getWriter().write("{\"authenticated\":false}");}))
   .addFilterBefore(throttle,UsernamePasswordAuthenticationFilter.class)
   .build();
 }
}
