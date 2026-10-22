package br.com.atlas;

import jakarta.validation.constraints.*;
import java.time.LocalDate;

public record RecordInput(
    @NotBlank @Size(max = 120) String country,
    @Size(max = 120) String state,
    @NotBlank @Size(max = 120) String city,
    @NotBlank @Size(max = 80) String virus,
    @Pattern(regexp = "Doença|Surto|Epidemia|Pandemia") String classification,
    @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
    @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
    @NotNull @Min(0) @Max(9007199254740991L) Long cases,
    @NotNull @Min(0) @Max(9007199254740991L) Long recovered,
    @NotNull @Min(0) @Max(9007199254740991L) Long deaths,
    @NotNull @PastOrPresent LocalDate date
) {}
