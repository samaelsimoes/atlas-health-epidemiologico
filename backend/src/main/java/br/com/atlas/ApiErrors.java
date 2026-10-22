package br.com.atlas;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.HttpStatus;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
@RestControllerAdvice
public class ApiErrors {
 @ExceptionHandler({MethodArgumentNotValidException.class,HttpMessageNotReadableException.class}) @ResponseStatus(HttpStatus.BAD_REQUEST)
 public Map<String,String> invalid(Exception e,HttpServletRequest request){
  if(request.getRequestURI().equals("/api/auth/setup"))return Map.of("message","Informe nome, e-mail válido e senha com 12 a 72 caracteres.");
  if(e instanceof MethodArgumentNotValidException invalid){var error=invalid.getBindingResult().getFieldErrors().stream().findFirst();if(error.isPresent())return Map.of("message","Confira o campo "+error.get().getField()+". Informe todos os campos obrigatórios, contagens inteiras, coordenadas válidas e data até hoje. Classificação: Doença, Surto, Epidemia ou Pandemia.");}
  return Map.of("message","JSON inválido. Confira os nomes dos campos, tipos de dados e datas no formato AAAA-MM-DD.");
 }
 @ExceptionHandler(DataIntegrityViolationException.class) @ResponseStatus(HttpStatus.CONFLICT)
 public Map<String,String> duplicate(Exception e){return Map.of("message","Este registro já existe ou excede o tamanho permitido.");}
}
