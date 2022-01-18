package org.broadinstitute.martha.models;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class Fields {

  public static final List<String> CORE_FIELDS =
      List.of(
          "gsUri",
          "bucket",
          "name",
          "fileName",
          "localizationPath",
          "contentType",
          "size",
          "hashes",
          "timeCreated",
          "timeUpdated");

  public static final List<String> ALL_FIELDS =
      Collections.unmodifiableList(
          new ArrayList<>() {
            {
              addAll(CORE_FIELDS);
              add("googleServiceAccount");
              add("bondProvider");
              add("accessUrl");
            }
          });

  public static final List<String> DEFAULT_FIELDS =
      Collections.unmodifiableList(
          new ArrayList<>() {
            {
              addAll(CORE_FIELDS);
              add("googleServiceAccount");
            }
          });

  public static final List<String> METADATA_FIELDS =
      Collections.unmodifiableList(
          new ArrayList<>() {
            {
              addAll(CORE_FIELDS);
              add("accessUrl");
            }
          });

  public static final List<String> BOND_SA_FIELDS = List.of("googleServiceAccount");

  public static final List<String> ACCESS_ID_FIELDS = List.of("accessUrl");

  public static Boolean overlapFields(List<String> requestedFields, List<String> serviceFields) {
    return serviceFields.containsAll(requestedFields);
  }
}
