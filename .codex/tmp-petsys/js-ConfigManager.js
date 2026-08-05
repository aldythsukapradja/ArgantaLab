"use strict";

// The Config Manager holds all the application settings in the config property
// All changes to the application configuration should be made here.  
define(['dojo/_base/declare'], function (declare) {
  "use strict";

  var instance = null;
  var configManager = declare(null, {
    config: {
      "defaults": {
        "state": "conventional"
      },
      "constants": {
        "US_BNDY_NAME_FIELD": "Name",
        "PROVINCE_NAME_FIELD": "PROVNAME",
        "PROVINCE_CODE_FIELD": "PROVCODE",
        "PROVINCE_REMARK_FIELD": "PROVSUMMARY",
        "PROVINCE_ID_FIELD": "OBJECTID_1",
        "PUB_NAME_FIELD": "TITLE",
        "PUB_AUTHOR_FIELD": "AUTHOR",
        "PUB_DATE_FIELD": "PUBLISHED_DATE",
        "PUB_TYPE_FIELD": "SERIES_INFO",
        "PUB_URL_FIELD": "URL",
        "PUB_OBJECTID_FIELD": "OBJECTID_1"
      },
      "Map": {
        "scale": 100000000,
        "center": [55.957018402650576, 24.772169861189035],
        "basemap": "gray",
        "components": ["zoom", "compass"],
        "viewPadding": {
          "top": 50
        },
        "uiPadding": {
          "top": 15
        },
        "dockOptions": {
          "position": "top-right"
        }
      },
      "ProvinceData": {
        "cont_url": "https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/World_Petroleum_Assessments/FeatureServer/1",
        "conv_url": "https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/World_Petroleum_Assessments/FeatureServer/2",
        "us_bndy_url": "https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/World_Petroleum_Assessments/FeatureServer/0",
        "opacity": 0.8,
        "outFields": ["*"],
        "cont_rel": 0,
        "conv_rel": 1
      },
      "PublicationData": {
        "url": "https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/World_Petroleum_Assessments/FeatureServer/3"
      }
    }
  });

  configManager.getInstance = function () {
    if (instance === null) {
      instance = new configManager();
    }

    return instance;
  };

  return configManager;
});
