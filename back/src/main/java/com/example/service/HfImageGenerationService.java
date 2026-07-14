package com.example.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class HfImageGenerationService {

    private final RestTemplate restTemplate;

    @Value("${hf.api.url:https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-3-medium-diffusers}")
    private String apiUrl;

    @Value("${hf.api.urls:}")
    private String apiUrls;

    @Value("${hf.api.token:}")
    private String apiToken;

    @Value("${hf.image.width:640}")
    private int imageWidth;

    @Value("${hf.image.height:640}")
    private int imageHeight;

    @Value("${hf.image.steps:8}")
    private int imageSteps;

    public String getCacheSignature() {
        String urls = String.join(",", getUrlCandidates());
        return urls + "|" + Math.max(256, imageWidth) + "x" + Math.max(256, imageHeight) + "|s="
                + Math.max(1, imageSteps);
    }

    public byte[] generateImage(String prompt) {
        if (apiToken == null || apiToken.isBlank()) {
            throw new RuntimeException("HF token manquant. Configure hf.api.token dans application-local.properties.");
        }
        String lastError = null;
        java.util.List<String> errors = new java.util.ArrayList<>();
        boolean onlyPaymentRequired = true;
        for (String url : getUrlCandidates()) {
            try {
                byte[] image = generateFromUrl(url, prompt);
                if (image != null && image.length > 0 && !isJsonError(image)) {
                    return image;
                }
                lastError = "Reponse HF invalide (JSON d'erreur) pour: " + url;
                errors.add(lastError);
                onlyPaymentRequired = false;
            } catch (org.springframework.web.client.HttpStatusCodeException e) {
                if (e.getStatusCode().value() == 402) {
                    lastError = "HF 402 PAYMENT_REQUIRED pour " + url;
                    errors.add(lastError);
                    continue;
                }

                String body = e.getResponseBodyAsString();
                lastError = "HF " + e.getStatusCode() + " pour " + url + ": " + body;
                errors.add(lastError);
                onlyPaymentRequired = false;
            } catch (RuntimeException e) {
                lastError = e.getMessage();
                errors.add(lastError);
                onlyPaymentRequired = false;
            }
        }

        if (!errors.isEmpty()) {
            if (onlyPaymentRequired) {
                throw new RuntimeException(
                        "Generation IA indisponible: credits Hugging Face epuises (402 PAYMENT_REQUIRED).");
            }
            throw new RuntimeException("Generation HF echouee. Details: " + String.join(" | ", errors));
        }
        throw new RuntimeException(lastError != null ? lastError : "Generation HF echouee.");
    }

    private byte[] generateFromUrl(String url, String prompt) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(MediaType.parseMediaTypes("image/png"));
        headers.setBearerAuth(apiToken);
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("width", Math.max(256, imageWidth));
        parameters.put("height", Math.max(256, imageHeight));
        parameters.put("num_inference_steps", Math.max(1, imageSteps));

        Map<String, Object> payload = new HashMap<>();
        payload.put("inputs", prompt);
        payload.put("parameters", parameters);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(
                payload,
                headers);

        ResponseEntity<byte[]> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                request,
                byte[].class);

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new RuntimeException("Generation HF echouee: " + response.getStatusCode());
        }

        return response.getBody();
    }

    private java.util.List<String> getUrlCandidates() {
        if (apiUrls != null && !apiUrls.isBlank()) {
            return java.util.Arrays.stream(apiUrls.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .toList();
        }
        return java.util.List.of(apiUrl);
    }

    private boolean isJsonError(byte[] body) {
        String prefix = new String(body, 0, Math.min(body.length, 32), StandardCharsets.UTF_8).trim();
        return prefix.startsWith("{") || prefix.startsWith("[");
    }
}
