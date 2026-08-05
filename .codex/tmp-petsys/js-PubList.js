"use strict";

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

define(['dojo/_base/declare', "esri/tasks/support/Query", "esri/tasks/support/RelationshipQuery", "esri/tasks/QueryTask", "dojo/topic"], function (declare, Query, RelationshipQuery, QueryTask, topic) {
  "use strict";

  var instance = null;
  var pubList = declare(null, {
    config: null,
    convQueryTask: null,
    contQueryTask: null,
    provRecentQueryTask: null,
    province: null,
    pubs: null,
    resourceType: null,
    constructor: function constructor(config) {
      this.config = config;
      this.convQueryTask = new QueryTask({
        url: this.config.ProvinceData.conv_url
      });
      this.contQueryTask = new QueryTask({
        url: this.config.ProvinceData.cont_url
      });
      this.pubsQueryTask = new QueryTask({
        url: this.config.PublicationData.url
      });
    },
    create: function create(province, checkProvcode) {
      var _this = this;

      if (province) {
        this.province = province;
      }

      this.getPubsData().then(function (pubs) {
        _this.pubs = pubs; // this.sortBy($("#sortOptions").val());

        _this.populatePubs(checkProvcode);
      }); // $("#sortOptions").change((evt) => {
      //     this.sortBy(evt.target.value);
      //     this.populatePubs(province);
      // });
    },
    getPubsData: function getPubsData() {
      var _this2 = this;

      var deferred = $.Deferred();

      if (this.province) {
        $("#dds69link").addClass("hidden");
        $("#dds69divider").addClass("hidden");
        var provinceId = this.province[this.config.constants.PROVINCE_ID_FIELD];
        var currentTask = this.resourceType === "cont" ? this.contQueryTask : this.convQueryTask;
        var relationshipId = this.resourceType === "cont" ? this.config.ProvinceData.cont_rel : this.config.ProvinceData.conv_rel;
        var relationshipQuery = new RelationshipQuery({
          objectIds: provinceId,
          relationshipId: relationshipId,
          outFields: ["*"],
          returnGeometry: false
        });
        currentTask.executeRelationshipQuery(relationshipQuery).then(function (results) {
          if (results[provinceId]) {
            var filteredFeatures = _this2.filterFeatures(results[provinceId].features);

            var pubs = filteredFeatures.map(function (feature) {
              return feature.attributes;
            });
            deferred.resolve(pubs);
          } else {
            deferred.reject();
          }
        });
      } else {
        var pubsQuery = new Query({
          where: "OBJECTID_1 > 0",
          outFields: ["*"],
          returnGeometry: true
        });

        if (this.resourceType === "conv") {
          //pubsQuery.where = "TITLE = 'An estimate of undiscovered conventional oil and gas resources of the world, 2012'"
          $("#dds69link").removeClass("hidden");
          $("#dds69divider").removeClass("hidden");
        } else {
          $("#dds69link").addClass("hidden");
          $("#dds69divider").addClass("hidden");
        }

        this.pubsQueryTask.execute(pubsQuery).then(function (results) {
          var filteredFeatures = _this2.filterFeatures(results.features);

          var pubs = filteredFeatures.map(function (feature) {
            return feature.attributes;
          });

          var uniquePubs = _toConsumableArray(new Map(pubs.map(function (item) {
            return [item["TITLE"], item];
          })).values());

          uniquePubs.sort(function (a, b) {
            return new Date(b[_this2.config.constants.PUB_DATE_FIELD]) - new Date(a[_this2.config.constants.PUB_DATE_FIELD]);
          });
          var mostRecentPubs;
          mostRecentPubs = uniquePubs.slice(0, 5);
          var relationshipId = _this2.resourceType === "cont" ? _this2.config.ProvinceData.cont_rel : _this2.config.ProvinceData.conv_rel;
          var pubIDs = mostRecentPubs.map(function (pub) {
            return pub[_this2.config.constants.PUB_OBJECTID_FIELD];
          });
          console.log(pubIDs);
          var pubsAssessmentsQuery = new RelationshipQuery({
            objectIds: pubIDs,
            relationshipId: relationshipId,
            outFields: ["*"],
            returnGeometry: true
          });

          _this2.pubsQueryTask.executeRelationshipQuery(pubsAssessmentsQuery).then(function (results) {
            var assessmentFeatures = [];
            pubIDs.forEach(function (pubID) {
              assessmentFeatures.push(results[pubID].features[0]);
            });
            topic.publish("assessmentFeaturesQueried", assessmentFeatures);
          });

          deferred.resolve(mostRecentPubs);
        });
      }

      return deferred.promise();
    },
    populatePubs: function populatePubs() {
      var _this3 = this;

      $("#provTitle").empty();

      if (this.province) {
        $("#provTitle").append(this.province[this.config.constants.PROVINCE_NAME_FIELD] + " Province");
      } else {
        //var provTitle = this.resourceType === "cont" ? "Most Recent Publications" : "Publications Highlight";
        var provTitle = "Most Recent Publications";
        $("#provTitle").append(provTitle);
      }

      $("#pubsList").empty();
      var sortedPubs = this.pubs.sort(function (a, b) {
        return new Date(b[_this3.config.constants.PUB_DATE_FIELD]) - new Date(a[_this3.config.constants.PUB_DATE_FIELD]);
      });
      sortedPubs.forEach(function (pub) {
        var pubCitation = _this3.createPubCitation(pub);

        $("#pubsList").append($("<div class='pubListItem'><div>" + pubCitation + "</div></div>"));
      });

      if (!$("#panelPubs").hasClass("in")) {
        this.hidePanels();
      } // $("#sortOptionsToolBar").removeClass("hidden");
      // $("#provinceDivider").removeClass("hidden");


      this.showPubList();
    },
    filterFeatures: function filterFeatures(features) {
      var _this4 = this;

      if (this.resourceType === "all") {
        return features;
      }

      var filteredFeatures = features.filter(function (feature) {
        if (_this4.resourceType === "conv") {
          return feature.attributes.PUBLICATION_MEETING_NAME === "Conventional" | feature.attributes.PUBLICATION_MEETING_NAME === "Conventional and Continuous";
        }

        if (_this4.resourceType === "cont") {
          return feature.attributes.PUBLICATION_MEETING_NAME === "Continuous" | feature.attributes.PUBLICATION_MEETING_NAME === "Conventional and Continuous";
        }
      });
      return filteredFeatures;
    },
    // sortBy: function(option) {
    //     switch (option) {
    //         case "year":
    //             this.pubs.sort((a, b) => {
    //                 return new Date(b[this.config.constants.PUB_DATE_FIELD]) - new Date(a[this.config.constants.PUB_DATE_FIELD])
    //             });
    //             break;
    //         case "author":
    //             this.pubs.sort((a, b) => {
    //                 var authorA = a[this.config.constants.PUB_AUTHOR_FIELD].toUpperCase();
    //                 var authorB = b[this.config.constants.PUB_AUTHOR_FIELD].toUpperCase();
    //                 if (authorA < authorB) {
    //                     return -1;
    //                 }
    //                 if (authorA > authorB) {
    //                     return 1;
    //                 }
    //                 return 0;
    //             });
    //             break;
    //         case "title":
    //             this.pubs.sort((a, b) => {
    //                 var titleA = a[this.config.constants.PUB_NAME_FIELD].toUpperCase();
    //                 var titleB = b[this.config.constants.PUB_NAME_FIELD].toUpperCase();
    //                 if (titleA < titleB) {
    //                     return -1;
    //                 }
    //                 if (titleA > titleB) {
    //                     return 1;
    //                 }
    //                 return 0;
    //             });
    //             break;
    //     }
    // },
    createPubCitation: function createPubCitation(pub) {
      var pubYear = new Date(pub[this.config.constants.PUB_DATE_FIELD]).getUTCFullYear();
      var pubCitation = pub[this.config.constants.PUB_AUTHOR_FIELD] + ", " + pubYear + ", " + pub[this.config.constants.PUB_NAME_FIELD] + ": " + pub[this.config.constants.PUB_TYPE_FIELD] + "<br>" + "Available at: <i><a target='blank' href='" + pub[this.config.constants.PUB_URL_FIELD] + "'>" + pub[this.config.constants.PUB_URL_FIELD] + "</a></i>";
      return pubCitation;
    },
    showPubList: function showPubList() {
      if ($("#panelPubs").hasClass("in")) {
        $("#panelPubs").removeClass("in");
        $("#panelPubs").children(".panel-collapse").removeClass("in");
      }

      $("#panelPubs").collapse("show");
      $("#panelPubs").children(".panel-collapse").collapse("show");
    },
    hidePanels: function hidePanels() {
      var panels = $(".calcite-panels .panel.in");
      panels.collapse("hide");
      panels.children(".panel-collapse").collapse("hide");
    }
  });

  pubList.getInstance = function (config) {
    if (instance === null) {
      instance = new pubList(config);
    }

    return instance;
  };

  return pubList;
});
