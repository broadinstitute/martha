package org.broadinstitute.martha;

import bio.terra.common.exception.ErrorReportException;
import java.util.List;
import javax.annotation.Nullable;
import org.springframework.http.HttpStatus;

public class MarthaException extends ErrorReportException {

  public MarthaException(String message) {
    super(message);
  }

  public MarthaException(String message, Throwable cause) {
    super(message, cause);
  }

  public MarthaException(Throwable cause) {
    super(cause);
  }

  public MarthaException(Throwable cause, HttpStatus statusCode) {
    super(cause, statusCode);
  }

  public MarthaException(
      String message, @Nullable List<String> causes, @Nullable HttpStatus statusCode) {
    super(message, causes, statusCode);
  }

  public MarthaException(
      String message,
      Throwable cause,
      @Nullable List<String> causes,
      @Nullable HttpStatus statusCode) {
    super(message, cause, causes, statusCode);
  }
}
