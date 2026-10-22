package br.com.atlas;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
@Component
public class LoginThrottle extends OncePerRequestFilter {
 private record Window(long start,int count){}
 private final ConcurrentHashMap<String,Window> attempts=new ConcurrentHashMap<>();
 @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
  if("POST".equals(req.getMethod())&&("/api/auth/login".equals(req.getServletPath())||"/api/auth/setup".equals(req.getServletPath()))){
   long now=System.currentTimeMillis();attempts.entrySet().removeIf(e->now-e.getValue().start>60000);
   Window w=attempts.compute(req.getRemoteAddr(),(key,old)->old==null||now-old.start>60000?new Window(now,1):new Window(old.start,old.count+1));
   if(w.count>10){res.setStatus(429);res.setHeader("Retry-After","60");res.setContentType("application/json;charset=UTF-8");res.getWriter().write("{\"message\":\"Muitas tentativas. Aguarde um minuto e tente novamente.\"}");return;}
  }
  chain.doFilter(req,res);
 }
}
