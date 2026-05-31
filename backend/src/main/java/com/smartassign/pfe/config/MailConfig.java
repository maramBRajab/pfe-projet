package com.smartassign.pfe.config;

import java.util.Properties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.util.StringUtils;

@Configuration
@EnableConfigurationProperties(AppMailProperties.class)
public class MailConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger(MailConfig.class);

    @Bean
    public JavaMailSender javaMailSender(
            @Value("${spring.mail.host:}") String host,
            @Value("${spring.mail.port:587}") int port,
            @Value("${spring.mail.username:}") String username,
            @Value("${spring.mail.password:}") String password,
            @Value("${spring.mail.default-encoding:UTF-8}") String encoding,
            @Value("${spring.mail.properties.mail.smtp.auth:true}") String smtpAuth,
            @Value("${spring.mail.properties.mail.smtp.starttls.enable:true}") String startTls,
            @Value("${spring.mail.properties.mail.smtp.starttls.required:true}") String startTlsRequired,
            @Value("${spring.mail.properties.mail.smtp.connectiontimeout:10000}") String connectionTimeout,
            @Value("${spring.mail.properties.mail.smtp.timeout:10000}") String timeout,
            @Value("${spring.mail.properties.mail.smtp.writetimeout:10000}") String writeTimeout) {

        JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
        mailSender.setDefaultEncoding(encoding);

        if (StringUtils.hasText(host)) {
            mailSender.setHost(host.trim());
            mailSender.setPort(port);
            mailSender.setUsername(StringUtils.hasText(username) ? username.trim() : null);
            mailSender.setPassword(StringUtils.hasText(password) ? password : null);

            Properties javaMailProperties = mailSender.getJavaMailProperties();
            javaMailProperties.put("mail.transport.protocol", "smtp");
            javaMailProperties.put("mail.smtp.auth", smtpAuth);
            javaMailProperties.put("mail.smtp.starttls.enable", startTls);
            javaMailProperties.put("mail.smtp.starttls.required", startTlsRequired);
            javaMailProperties.put("mail.smtp.connectiontimeout", connectionTimeout);
            javaMailProperties.put("mail.smtp.timeout", timeout);
            javaMailProperties.put("mail.smtp.writetimeout", writeTimeout);
        }

        logMailConfiguration(host, port, username);

        return mailSender;
    }

    private void logMailConfiguration(String host, int port, String username) {
        if (!StringUtils.hasText(host)) {
            LOGGER.warn(
                    "SMTP non configure : spring.mail.host est vide. "
                            + "Definissez SPRING_MAIL_HOST (ex. smtp.gmail.com) et les identifiants, "
                            + "ou activez app.mail.dev-log-reset-link=true en developpement.");
            return;
        }

        boolean hasCredentials = StringUtils.hasText(username);
        LOGGER.info(
                "JavaMailSender configure — hote={}:{} utilisateur={}",
                host.trim(),
                port,
                hasCredentials ? maskEmail(username.trim()) : "(non renseigne)");

        if (!hasCredentials) {
            LOGGER.warn(
                    "Identifiants SMTP absents : definissez SPRING_MAIL_USERNAME et SPRING_MAIL_PASSWORD "
                            + "(mot de passe d'application Gmail en developpement).");
        }
    }

    private static String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(at);
    }
}
