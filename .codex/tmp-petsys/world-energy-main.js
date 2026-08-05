"use strict";

require(["app/js/MapManager", "app/js/ConfigManager", "app/js/PubList", "dojo/topic", "dojo/io-query", "dojo/domReady!"], function (MapManager, ConfigManager, PubList, topic, ioQuery) {
  "use sctrict";

  var config, mapManager, pubList, queryTask, queryObject;
  config = ConfigManager.getInstance().config;

  function init() {
    mapManager = MapManager.getInstance(config);
    pubList = PubList.getInstance(config);
    var params = document.location.search.substr(document.location.search[0] === "?" ? 1 : 0);
    queryObject = ioQuery.queryToObject(params);
    subcribe();
    $("input[name='resourceType']").change(changeResourceType); // showPubsPanel();
  }

  function subcribe() {
    topic.subscribe("provinceClicked", onProvinceClicked);
    topic.subscribe("resetPubList", resetPubList);
    topic.subscribe("layersReady", onLayersReady);
    topic.subscribe("assessmentFeaturesQueried", onAssessmentFeaturesQueried);
  }

  function onLayersReady() {
    if (!queryObject["resource"]) {
      changeResourceType();
    } else {
      var resourceType;

      if (queryObject["resource"] === "conventional") {
        resourceType = "conv";
      } else if (queryObject["resource"] === "continuous") {
        resourceType = "cont";
      } else {
        resourceType = $("input[name='resourceType']:checked").val();
      }

      pubList.resourceType = resourceType;
      $("#" + resourceType).prop("checked", true);

      if (!queryObject["provcode"]) {
        changeResourceType();
      } else {
        mapManager.toggleLayers(resourceType);
        mapManager.selectProvinceByProvcode(queryObject["provcode"]);
      }
    }
  }

  function onProvinceClicked(province) {
    pubList.resourceType = $("input[name='resourceType']:checked").val();
    pubList.create(province);
  }

  function showPubsPanel() {
    $("#panelPubs").collapse("show");
    $("#panelPubs").children(".panel-collapse").collapse("show");
  }

  function changeResourceType() {
    var resourceType = $("input[name='resourceType']:checked").val();
    mapManager.toggleLayers(resourceType);
    pubList.resourceType = resourceType;
    pubList.province = null;
    pubList.create(); // var filteredPubs = this.filterPubs(this.pubs);
    // this.populatePubs(filteredPubs);
  }

  function onAssessmentFeaturesQueried(assessmentFeatures) {
    mapManager.highlightRecentFeatures(assessmentFeatures);
  }

  function resetPubList() {
    pubList.province = null;
    pubList.create();
  }

  function closePanels() {
    var panels = $(".calcite-panels .panel.in");
    panels.collapse("hide");
    panels.children(".panel-collapse").collapse("hide");
  }

  init();
});
