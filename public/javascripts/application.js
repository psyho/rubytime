var EVENTS = {
  activity_added: 'activitites:added',
  activity_updated: 'activitites:updated',
  activity_deleted: 'activitites:deleted',
  vacation_added: 'activitites:vacation_added',
  vacation_removed: 'activitites:vacation_removed',
  add_activity_clicked: 'activitites:add_clicked'
};

function hoursFormat(value, element, params) {
  return this.optional(element) || (/^\d+([\.,]\d+|:[0-5]\d)?$/).test(value);
};

var Application = {
  init: function() {
    Application.setupAjax();
    Application.setupValidator();
    Application.initDatepickers();
    Application.initAddActivityButton();
    Application.initTables();
    Application.initFlash();
    Application.initDeleteLinks();
    Application.initAddVacation();
    Application.initRemoveVacation();
    $(document).bind(EVENTS.activity_added, function() {
      Application.notice('Activity added successfully.');
    });
    $(document).bind(EVENTS.activity_updated, function() {
      Application.notice('Activity updated successfully.');
    });
    $(document).bind(EVENTS.activity_deleted, function() {
      Application.notice('Activity removed successfully.');
    });
    $(document).bind(EVENTS.vacation_added, function() {
      Application.notice('Vacation added successfully.');
    });
    $(document).bind(EVENTS.vacation_removed, function() {
      Application.notice('Vacation removed successfully.');
    });
    $(document).bind('tb:ajax_loaded', function() {
      Application._initActivityPopup($("#TB_ajaxContent"));
    });
  },
  
  setupAjax: function() {
    $.ajaxSetup({
      error: function(xhr) {
        Application.errorFromXhr(xhr);
      }
    });
  },
  
  setupValidator: function() {
    $.validator.addMethod('hours', hoursFormat, "Please enter hours in format like 3:45 or 2,5.");
  },

  initDatepickers: function(selector) {
    $(selector || ".datepicker").datepicker({
      dateFormat: window.rubytime_date_format || 'dd-mm-yy',
      duration: "",
      showOn: "both",
      buttonImage: "/images/icons/calendar_month.png",
      buttonImageOnly: true
    });
  },
  
  initAddActivityButton: function() {
    $(".add-activity a").click(function() {
      $(document).trigger(EVENTS.add_activity_clicked); return false;
    });
    $(document).bind(EVENTS.add_activity_clicked, function(e, memory) {
      // don't hide form if memory which means click on calendar form
      if ($("#add_activity .activity_form").length > 0 && !memory) {
        Application._closeActivityPopup();
      } else {
        var params = "";
        if (memory && memory.user_id) {
          params += "user_id=" + memory.user_id;
        }
        if (memory && memory.date) {
          params += "&date=" + memory.date;
        }
        $("#add_activity").load("/activities/new?" + params, function() {
          $("#add_activity").slideDown("fast", function() {
            Application._initActivityPopup($("#add_activity"));
          });
          $.scrollTo('.header');
        });
      }
      return false;
    });
  },

  initAddVacation: function() {
    $(document).bind(EVENTS.vacation_added, function(e, memory) {
      var params = "";
      if (memory && memory.user_id) {
        params += "user_id=" + memory.user_id;
      }
      if (memory && memory.date) {
        params += "&date=" + memory.date;
      }
      // wyswietlic w error messages
      $.ajax({
        type: "GET",
        url: "/free_days/new",
        data: params
      });
      return false;
    });
  
  },

  initRemoveVacation: function() {
    $(document).bind(EVENTS.vacation_removed, function(e, memory) {
      var params = "";
      if (memory && memory.user_id) {
        params += "user_id=" + memory.user_id;
      }
      if (memory && memory.date) {
        params += "&date=" + memory.date;
      }
      // wyswietlic w error messages
      $.ajax({
        type: "GET",
        url: "/free_days/delete",
        data: params
      });
      return false;
    });
  },
  
  initTables: function() {
    $("table").zebra();
    $("table.list tr").mouseover(function() {
      $(this).addClass("hovered")
    }).mouseout(function() {
      $(this).removeClass("hovered")
    });
  },

  initFlash: function() {
    $("#flash").click(Application._closeFlash);
    setTimeout(Application._closeFlash, 5000);
  },
  
  initDeleteLinks: function() {
    $(".delete_row").click(function (e) {
      if (confirm('Are you sure?')) {
        var target = $(this);
        var row = target.parents('tr');
        var handler = arguments.callee;

        $.ajax({
          type: "DELETE",
          url: $(this).url(),
          beforeSend: function() {
            target.unbind('click', handler); row.disableLinks();
          },
          success: function() {
            table = row.parents("table");
            row.remove();
            table.zebra();
          },
          error: function(xhr) {
            target.click(handler);
            row.enableLinks();
            Application.errorFromXhr(xhr);
          }
        });
      };
      return false;
    });
  },
  
  _closeActivityPopup: function() {
    // close new activity popup
    // slide up and remove the form
    $("#add_activity").slideUp("fast", function() {
      $("#add_activity .activity_form").remove();
    });
    // close edit activity popup
    tb_remove();
    return false;
  },

  _initActivityPopup: function(container) {
    // hide popup on clicking Cancel link
    container.find("#close_activity_form").click(Application._closeActivityPopup);

    // set validation rules
    container.find(".activity_form").validate({
      rules: {
        "activity[hours]": {
          required: true,
          hours: true
        },
        "activity[comments]": {
          required: true
        }
      }
    });

    // init datepicker
    Application.initDatepickers(".activity_form .datepicker");

    // focus first blank field (hours)
    container.find(".activity_form").focusFirstBlank();

    // handle form submission
    container.find(".activity_form").submit(function() {
      var form = $(this);
      if (!form.valid()) return false;
      $.ajax({
        url: form.url(),
        type: "POST",
        data: form.serialize(),
        dataType: 'json',
        success: function(responseJson) {
          var date = responseJson.date;
          Application._closeActivityPopup();
          // check if we were editing or creating new activity
          if ((/\d+$/).test(form.url())) {
            $(document).trigger(EVENTS.activity_updated, {
              date: date
            });
          } else {
            $(document).trigger(EVENTS.activity_added, {
              date: date
            });
          }
        },
        error: function(xhr) {
          container.html(xhr.responseText);
          Application._initActivityPopup(container);
        }
      });
      container.find(".activity_form input[type=submit]").attr("disabled", "true");
      return false;
    });
  },
  
  _showFlash: function(klass, message) {
    $.scrollTo($("#flash").removeClass("error").removeClass("notice").addClass(klass).text(message).fadeIn());
    Application.initFlash();
  },
  
  _closeFlash: function() {
    $("#flash").fadeOut(function() {
      $(this).removeClass("notice").removeClass("error").hide();
    });
  },

  notice: function(message) {
    Application._showFlash("notice", message);
  },
  
  error: function(message) {
    Application._showFlash("error", message);
  },
  
  errorFromXhr: function(xhr) {
    if (xhr.status >= 400 && xhr.status < 500)
      Application.error(xhr.responseText);
    if(xhr.status >= 500)
      Application.error("Ooops! Something went wrong.");
  },
  
  initCommentsIcons: function() {
    $(".toggle_comments_link").click(function() {
      $(this).parents("tr").next().toggle();
      return false;
    });
    $(".toggle_all_comments_link").click(function() {
      var comments = $(this).parents("table").find("tr.comments");
      if (comments.filter(":visible").length > 0 && comments.filter(":hidden").length > 0) {
        comments.hide();
      }
      comments.toggle();
      return false;
    });
  }
};
$(Application.init);
