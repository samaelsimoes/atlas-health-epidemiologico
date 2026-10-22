package br.com.atlas;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.security.Principal;
import java.util.*;
import java.nio.charset.StandardCharsets;
@RestController @RequestMapping("/api/auth")
public class AuthController {
 private final AccountRepository accounts;private final PasswordEncoder encoder;
 public AuthController(AccountRepository accounts,PasswordEncoder encoder){this.accounts=accounts;this.encoder=encoder;}
 public record Setup(@NotBlank @Size(max=80) String name,@NotBlank @Email @Size(max=160) String email,@NotBlank @Size(min=12,max=72) String password){}
 @GetMapping("/csrf") public Map<String,String> csrf(CsrfToken token){return Map.of("token",token.getToken(),"headerName",token.getHeaderName());}
 @GetMapping("/status") public Map<String,Boolean> status(){return Map.of("initialized",accounts.count()>0);}
 @PostMapping("/setup") @ResponseStatus(HttpStatus.CREATED)
 public synchronized Map<String,Boolean> setup(@Valid @RequestBody Setup input){
  if(accounts.count()>0)throw new ResponseStatusException(HttpStatus.CONFLICT,"A conta administradora já foi configurada. Faça login.");
  if(input.password().getBytes(StandardCharsets.UTF_8).length>72)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A senha deve ocupar no máximo 72 bytes. Use menos caracteres.");
  Account account=new Account();account.name=input.name().trim();account.email=input.email().trim().toLowerCase(Locale.ROOT);account.passwordHash=encoder.encode(input.password());accounts.saveAndFlush(account);return Map.of("initialized",true);
 }
 @GetMapping("/me") public Map<String,String> me(Principal principal){Account a=accounts.findByEmail(principal.getName()).orElseThrow(()->new ResponseStatusException(HttpStatus.UNAUTHORIZED));return Map.of("name",a.name,"email",a.email,"role","Administrador");}
}
