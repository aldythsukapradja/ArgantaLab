"use strict";

define(['dojo/_base/declare', 'esri/Map', "esri/Basemap", "esri/layers/FeatureLayer", "esri/layers/TileLayer", "esri/layers/VectorTileLayer", "esri/views/SceneView", 'esri/widgets/BasemapGallery', "esri/widgets/Search", "esri/tasks/Locator", "esri/tasks/support/Query", "dojo/dom", "dojo/dom-style", "dojo/dom-construct", "dojo/query", "dojo/topic"], function (declare, Map, Basemap, FeatureLayer, TileLayer, VectorTileLayer, SceneView, BasemapGallery, Search, Locator, Query, dom, domStyle, domConstruct, dojoQuery, topic) {
  "use strict";

  var instance = null;
  var mapManager = declare(null, {
    config: null,
    map: null,
    mapView: null,
    basemapGallery: null,
    conv_provs: null,
    cont_provs: null,
    currentLayer: null,
    us_bndy: null,
    locator: null,
    convLayerView: null,
    contLayerView: null,
    currentLayerView: null,
    convHighlight: null,
    contHighlight: null,
    currentHighlight: null,
    constructor: function constructor(config) {
      var _this = this;

      this.config = config;
      var basemap = new Basemap({
        baseLayers: [new TileLayer({
          url: "https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer"
        })]
      });
      this.map = new Map({
        basemap: basemap
      });
      this.mapView = new SceneView({
        container: "mapViewDiv",
        map: this.map,
        scale: this.config.Map.scale,
        center: this.config.Map.center,
        padding: this.config.Map.viewPadding,
        ui: {
          components: this.config.Map.components,
          padding: this.config.Map.uiPadding
        }
      });
      this.basemapGallery = new BasemapGallery({
        view: this.mapView,
        container: "basemapGalleryContainer"
      });
      this.conv_provs = new FeatureLayer({
        url: this.config.ProvinceData.conv_url,
        opacity: 0.6,
        outFields: ["*"]
      });
      this.cont_provs = new FeatureLayer({
        url: this.config.ProvinceData.cont_url,
        opacity: 0.6,
        outFields: ["*"],
        visible: false
      });
      this.us_bndy = new FeatureLayer({
        url: this.config.ProvinceData.us_bndy_url,
        opacity: 0.2,
        outFields: ["*"],
        sublayers: [{
          id: 0,
          visible: true
        }]
      });
      this.locator = new Locator({
        url: "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer"
      });
      this.map.add(this.conv_provs);
      this.map.add(this.cont_provs);
      this.map.add(this.us_bndy);
      this.mapView.whenLayerView(this.conv_provs).then(function (layerView1) {
        _this.convLayerView = layerView1;

        _this.mapView.whenLayerView(_this.cont_provs).then(function (layerView2) {
          _this.contLayerView = layerView2;
          topic.publish("layersReady");
        });
      });
      this.setOnFeatureClicked();
      this.setSearchWiget();
      this.setTooltip();
    },
    setSearchWiget: function setSearchWiget() {
      var _this2 = this;

      this.searchWidgetNav = new Search({
        view: this.mapView,
        allPlaceholder: "Enter a province name",
        includeDefaultSources: false,
        resultGraphicEnabled: false,
        popupEnabled: false
      }, "searchNavDiv");
      this.searchWidgetNav.startup();
      this.searchWidgetNav.on("search-complete", function (evt) {
        if (_this2.currentHighlight) {
          _this2.currentHighlight.remove();
        }

        if (evt.results[0].source.name === "Place Names") {
          var extent = _this2.searchWidgetNav.results[0].results[0].extent;
          var query = new Query({
            geometry: extent,
            spatialRelationship: "intersects",
            outFields: ["*"],
            returnGeometry: false
          });

          _this2.currentLayer.queryFeatures(query).then(function (results) {
            if (results.features.length > 0) {
              var province = results.features[0].attributes;
              _this2.currentHighlight = _this2.currentLayerView.highlight(results.features[0]);
              topic.publish("provinceClicked", province);
            } else {
              topic.publish("resetPubList");
            }
          });
        } else {
          var province = evt.results[0].results[0].feature.attributes;
          topic.publish("provinceClicked", province);
        }
      });
      this.searchWidgetNav.on("search-clear", function (evt) {
        if (_this2.currentHighlight) {
          _this2.currentHighlight.remove();
        }
      });
    },
    setTooltip: function setTooltip() {
      var _this3 = this;

      this.mapView.on("pointer-move", function (evt) {
        var screenPoint = {
          x: evt.x,
          y: evt.y
        };

        _this3.mapView.hitTest(screenPoint).then(function (response) {
          if (response.results.length > 0) {
            var field = null;

            if (response.results[0].graphic.layer.sourceJSON.name === "us_bndy") {
              field = _this3.config.constants.US_BNDY_NAME_FIELD;
            } else {
              field = _this3.config.constants.PROVINCE_NAME_FIELD;
            }

            $('html,body').css('cursor', 'pointer');
            var labels = dojoQuery("#provinceLabel p");
            labels.forEach(function (label) {
              domConstruct.destroy(label);
            });
            domConstruct.create("p", {
              innerHTML: response.results[0].graphic.attributes[field]
            }, dom.byId("provinceLabel"));
            domStyle.set('provinceLabel', 'display', 'block');
            domStyle.set('provinceLabel', 'top', screenPoint.y + 'px');
            domStyle.set('provinceLabel', 'left', screenPoint.x + 'px');
          } else {
            $('html,body').css('cursor', 'default');
            domStyle.set('provinceLabel', 'display', 'none');
          }
        });
      });
      this.mapView.on("pointer-leave", function () {
        $('html,body').css('cursor', 'default');
        domStyle.set('provinceLabel', 'display', 'none');
      });
    },
    setOnFeatureClicked: function setOnFeatureClicked() {
      var _this4 = this;

      this.mapView.on("click", function (evt) {
        _this4.searchWidgetNav.clear();

        var screenPoint = {
          x: evt.x,
          y: evt.y
        };

        _this4.mapView.hitTest(screenPoint).then(function (response) {
          if (response.results.length > 0) {
            if (response.results[0].graphic.layer.sourceJSON.name === "us_bndy") {
              window.location.href = "https://www.usgs.gov/centers/cersc/science/united-states-assessments-undiscovered-oil-and-gas-resources?qt-science_center_objects=0#qt-science_center_objects";
            } else {
              topic.publish("provinceClicked", response.results[0].graphic.attributes);
            }

            if (_this4.currentHighlight) {
              _this4.currentHighlight.remove();
            }

            _this4.currentHighlight = _this4.currentLayerView.highlight(response.results[0].graphic);
          }
        });
      });
    },
    toggleLayers: function toggleLayers(resourceType) {
      if (this.currentHighlight) {
        this.currentHighlight.remove();
      }

      this.setLayersByType(resourceType);

      switch (resourceType) {
        case "conv":
          this.cont_provs.visible = false;
          this.conv_provs.visible = true;
          this.searchWidgetNav.sources = [{
            layer: this.conv_provs,
            searchFields: ["PROVNAME"],
            displayField: "PROVNAME",
            exactMatch: false,
            outFields: ["*"],
            placeholder: "Enter a province name",
            name: "Conventional Assessments",
            resultGraphicEnabled: false
          }, {
            locator: this.locator,
            singleLineFieldName: "SingleLine",
            outFields: ["Addr_type"],
            name: "Place Names",
            placeholder: "Enter a place name"
          }];
          break;

        case "cont":
          this.conv_provs.visible = false;
          this.cont_provs.visible = true;
          this.searchWidgetNav.sources = [{
            layer: this.cont_provs,
            searchFields: ["PROVNAME"],
            displayField: "PROVNAME",
            exactMatch: false,
            outFields: ["*"],
            placeholder: "Enter a province name",
            name: "Continuous Assessments",
            resultGraphicEnabled: false
          }, {
            locator: this.locator,
            singleLineFieldName: "SingleLine",
            outFields: ["Addr_type"],
            name: "Place Names",
            placeholder: "Enter a place name"
          }];
          break;
      }
    },
    selectProvinceByProvcode: function selectProvinceByProvcode(provcode) {
      var _this5 = this;

      var query = new Query({
        where: this.config.constants.PROVINCE_CODE_FIELD + " = '" + provcode + "'",
        outFields: ["*"],
        returnGeometry: false
      });
      this.currentLayer.queryFeatures(query).then(function (results) {
        if (results.features.length > 0) {
          var province = results.features[0].attributes;
          topic.publish("provinceClicked", province);

          var handle = _this5.currentLayerView.watch("updating", function (value) {
            if (!value) {
              _this5.highlightRecentFeatures(results.features, handle);
            }
          });
        } else {
          topic.publish("resetPubList");
        }
      });
    },
    setLayersByType: function setLayersByType(resourceType) {
      this.currentLayer = resourceType === "cont" ? this.cont_provs : this.conv_provs;
      this.currentHighlight = resourceType === "cont" ? this.contHighlight : this.convHighlight;
      this.currentLayerView = resourceType === "cont" ? this.contLayerView : this.convLayerView;
    },
    highlightRecentFeatures: function highlightRecentFeatures(assessmentFeatures, handle) {
      if (handle) {
        handle.remove();
      }

      if (this.currentHighlight) {
        this.currentHighlight.remove();
      }

      this.currentHighlight = this.currentLayerView.highlight(assessmentFeatures);
      this.mapView.goTo(assessmentFeatures);
    }
  });

  mapManager.getInstance = function (config) {
    if (instance === null) {
      instance = new mapManager(config);
    }

    return instance;
  };

  return mapManager;
});
