package io.backend.fileservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "io.backend.fileservice")
public class FileserviceApplication {

	public static void main(String[] args) {
		SpringApplication.run(FileserviceApplication.class, args);
	}

}
