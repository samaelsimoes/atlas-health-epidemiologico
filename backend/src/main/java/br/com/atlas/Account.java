package br.com.atlas;
import jakarta.persistence.*;
@Entity @Table(name="atlas_account")
public class Account {
 @Id @GeneratedValue(strategy=GenerationType.UUID) public String id;
 @Column(nullable=false,length=80) public String name;
 @Column(nullable=false,unique=true,length=160) public String email;
 @Column(nullable=false) public String passwordHash;
}
