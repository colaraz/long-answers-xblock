/* Javascript for LongQuestionXBlock. */
function LongQuestionXBlock(runtime, element) {
    var _LongQuestionXBlock = this;
    _LongQuestionXBlock.STATE = {
        STAFF_GRADING_DATA: null,
    };

    _LongQuestionXBlock.URL = {
        SAVE_ASSIGNMENT: runtime.handlerUrl(element, 'save_assignment'),
        GET_STUDENT_STATE: runtime.handlerUrl(element, 'get_student_state'),
        SUBMIT_ASSIGNMENT: runtime.handlerUrl(element, 'submit_assignment'),
        GET_STAFF_GRADING: runtime.handlerUrl(element, 'get_staff_grading_data'),
        ENTER_GRADE: runtime.handlerUrl(element, 'enter_grade'),
        REMOVE_GRADE: runtime.handlerUrl(element, 'remove_grade'),
        GET_STUDENT_SUBMISSION: runtime.handlerUrl(element, 'get_student_submission'),
    };

    _LongQuestionXBlock.TEMPLATE = {
        LQ_TEMPLATE: null,
        LQ_GRADING_TEMPLATE: null,
    };

    _LongQuestionXBlock.SELECTOR = {
        LQ_BLOCK: '.sga-block',
        LQ_TEMPLATE: '#sga-tmpl',
        LQ_CONTENT: '#sga-content',
        LQ_GRADING_TEMPLATE: '#sga-grading-tmpl',
        COMMENT_INPUT: '#comment-input',
        DISPLAY_NAME: '.sga-block .display_name',
        ENTER_GRADE_FORM: '#enter-grade-form',
        ENTER_GRADE_BUTTON: '.enter-grade-button',
        ENTER_GRADE_CANCEL_BUTTON: '#enter-grade-cancel',
        MODULE_ID_INPUT: '#module_id-input',
        REMOVE_GRADE: '#remove-grade',
        STUDENT_NAME: '#student-name',
        STUDENT_ANSWER_FORM: '#student-answer-form',
        STUDENT_GRADE_INFO: '#grade-info #row',
        SUBMIT_ASSIGNMENT: '.finalize-upload',
        SUBMISSIONS: '#submissions',
        SUBMISSION_ID_INPUT: '#submission_id-input',
        SUCCESS_MESSAGE: '#success-message',
        GRADE_INFO: '#grade-info',
        GRADE_INPUT: '#grade-input',
        GRADE_MODAL: '.grade-modal',
        GRADE_SUBMISSION_BUTTON: '#grade-submissions-button',
        VIEW_STUDENT_SUBMISSION: '#student-submission',
        VIEW_SUBMISSION_BUTTON: '.view-submission-button',
        VIEW_SUBMISSION_CANCEL_BUTTON: '#view-submission-cancel',
    }

    _LongQuestionXBlock.ELEMENT = {
        LQ_BLOCK: $(_LongQuestionXBlock.SELECTOR.LQ_BLOCK, element),
        LQ_TEMPLATE: $(_LongQuestionXBlock.SELECTOR.LQ_TEMPLATE, element),
        LQ_CONTENT: $(_LongQuestionXBlock.SELECTOR.LQ_CONTENT, element),
        COMMENT_INPUT: $(_LongQuestionXBlock.SELECTOR.COMMENT_INPUT, element),
        DISPLAY_NAME: $(_LongQuestionXBlock.SELECTOR.DISPLAY_NAME, element),
        ENTER_GRADE_FORM: $(_LongQuestionXBlock.SELECTOR.ENTER_GRADE_FORM, element),
        ENTER_GRADE_CANCEL_BUTTON: $(_LongQuestionXBlock.SELECTOR.ENTER_GRADE_CANCEL_BUTTON, element),
        MODULE_ID_INPUT: $(_LongQuestionXBlock.SELECTOR.MODULE_ID_INPUT, element),
        STUDENT_NAME: $(_LongQuestionXBlock.SELECTOR.STUDENT_NAME, element),
        SUBMISSION_ID_INPUT: $(_LongQuestionXBlock.SELECTOR.SUBMISSION_ID_INPUT, element),
        GRADE_INFO: $(_LongQuestionXBlock.SELECTOR.GRADE_INFO, element),
        GRADE_INPUT: $(_LongQuestionXBlock.SELECTOR.GRADE_INPUT, element),
        GRADE_MODAL: $(_LongQuestionXBlock.SELECTOR.GRADE_MODAL, element),
        GRADE_SUBMISSION_BUTTON: $(_LongQuestionXBlock.SELECTOR.GRADE_SUBMISSION_BUTTON, element),
        VIEW_SUBMISSION_CANCEL_BUTTON: $(_LongQuestionXBlock.SELECTOR.VIEW_SUBMISSION_CANCEL_BUTTON, element),
    }

    function xblock($, _) {
        _LongQuestionXBlock.TEMPLATE.LQ_TEMPLATE = _.template(_LongQuestionXBlock.ELEMENT.LQ_TEMPLATE.text());
        $(function($) {
            _LongQuestionXBlock.init();

            if (_LongQuestionXBlock.isStaff()) {
                _LongQuestionXBlock.initStaffGrading(element);
            }
        });
    }

    if (require === undefined) {
        xblock($, _);
    } else {
        require(['jquery', 'underscore'], xblock);
    }
}

LongQuestionXBlock.prototype.init = function(){
    var _LongQuestionXBlock = this;
    $.post(_LongQuestionXBlock.URL.GET_STUDENT_STATE)
    .success(function (response) {
        _LongQuestionXBlock.render(response);
    })
    .fail(function () {
        console.error('Unable to fetch XBlock State')
    });
}

LongQuestionXBlock.prototype.initStaffGrading = function(element){
    var _LongQuestionXBlock = this;

    _LongQuestionXBlock.TEMPLATE.LQ_GRADING_TEMPLATE = _.template(
        $(element).find(_LongQuestionXBlock.SELECTOR.LQ_GRADING_TEMPLATE).text()
    );

    _LongQuestionXBlock.ELEMENT.GRADE_SUBMISSION_BUTTON
        .leanModal()
        .on('click', function() {
            if(!_LongQuestionXBlock.STATE.STAFF_GRADING_DATA){
                $.ajax({
                    url: _LongQuestionXBlock.URL.GET_STAFF_GRADING,
                    success: (function(response) {
                        _LongQuestionXBlock.STATE.STAFF_GRADING_DATA = response;
                        _LongQuestionXBlock.renderStaffGrading(response);
                    })
                });
            }else{
                _LongQuestionXBlock.renderStaffGrading(_LongQuestionXBlock.STATE.STAFF_GRADING_DATA);
            }
        });

    _LongQuestionXBlock.ELEMENT.LQ_BLOCK.find('#staff-debug-info-button')
        .leanModal();


    _LongQuestionXBlock.ELEMENT.ENTER_GRADE_CANCEL_BUTTON.on('click', function() {
        setTimeout(function() {
            _LongQuestionXBlock.ELEMENT.GRADE_SUBMISSION_BUTTON.click();
            _LongQuestionXBlock.gradeFormError('');
        }, 225);
    });

    _LongQuestionXBlock.ELEMENT.VIEW_SUBMISSION_CANCEL_BUTTON.on('click', function() {
        setTimeout(function() {
            _LongQuestionXBlock.ELEMENT.GRADE_SUBMISSION_BUTTON.click();
        }, 225);
    });
}

LongQuestionXBlock.prototype.render = function(data){
    var _LongQuestionXBlock = this;
    data.error = data.error || false;
    data.success = data.success || false;

    var content = _LongQuestionXBlock.ELEMENT.LQ_CONTENT.html(
        _LongQuestionXBlock.TEMPLATE.LQ_TEMPLATE(data)
    );

    var form = $(content).find(_LongQuestionXBlock.SELECTOR.STUDENT_ANSWER_FORM);

    if (form.length) {
        var submitted = data.submitted;
        var student_answer = submitted ? submitted.student_answer: '';
        CKEDITOR.replace("assignment_answer").setData(student_answer);
    }

    $(content).find(_LongQuestionXBlock.SELECTOR.SUBMIT_ASSIGNMENT).off('click').on('click', function() {
        CKEDITOR.instances["student-answer-textarea"].updateElement();
        $.post(_LongQuestionXBlock.URL.SUBMIT_ASSIGNMENT, form.serialize())
        .success(function (data) {
            _LongQuestionXBlock.render(data);
        })
        .fail(function (data) {
            data.error = gettext('Submission failed. Please contact your course instructor.');
            _LongQuestionXBlock.render(data);
        });
    });

    form.off('submit').on('submit', function(event) {
        event.preventDefault();
        CKEDITOR.instances["student-answer-textarea"].updateElement();
        $.post(_LongQuestionXBlock.URL.SAVE_ASSIGNMENT, form.serialize())
        .success(function (data) {
            $('#success-message').show();
            setTimeout(function(){
                $('#success-message').hide();
            }, 2000);
        }).fail(function (data) {
            data.error = gettext('Could not save Answer. Please contact your course instructor.');
            _LongQuestionXBlock.render(data);
        });
    });

}

LongQuestionXBlock.prototype.renderStaffGrading = function(data) {
    var _LongQuestionXBlock = this;

    if (data.hasOwnProperty('error')) {
        _LongQuestionXBlock.gradeFormError(data['error']);
    } else {
        _LongQuestionXBlock.gradeFormError('');
        _LongQuestionXBlock.ELEMENT.GRADE_MODAL.hide();
    }

    if (data.display_name !== '') {
        _LongQuestionXBlock.ELEMENT.DISPLAY_NAME.html(data.display_name);
    }

    // Render template
    _LongQuestionXBlock.ELEMENT.GRADE_INFO
        .html(_LongQuestionXBlock.TEMPLATE.LQ_GRADING_TEMPLATE(data))
        .data(data);

    // Map data to table rows
    data.assignments.map(function(assignment) {
      _LongQuestionXBlock.ELEMENT.LQ_BLOCK.find(
        _LongQuestionXBlock.SELECTOR.STUDENT_GRADE_INFO + '-' + assignment.module_id
        ).data(assignment);
    });

    // Set up grade entry modal
    _LongQuestionXBlock.ELEMENT.LQ_BLOCK
        .find(_LongQuestionXBlock.SELECTOR.ENTER_GRADE_BUTTON)
        .leanModal({closeButton: _LongQuestionXBlock.SELECTOR.ENTER_GRADE_CANCEL_BUTTON})
        .on('click', function (e) {
            _LongQuestionXBlock.handleGradeEntry(e);
        });

    _LongQuestionXBlock.ELEMENT.LQ_BLOCK
        .find(_LongQuestionXBlock.SELECTOR.VIEW_SUBMISSION_BUTTON)
        .leanModal({closeButton: _LongQuestionXBlock.SELECTOR.VIEW_SUBMISSION_CANCEL_BUTTON})
        .on('click', function(e){
            _LongQuestionXBlock.handleViewSubmission(e);
        });

    $.tablesorter.addParser({
      id: 'alphanum',
      is: function(s) {
        return false;
      },
      format: function(s) {
        var str = s.replace(/(\d{1,2})/g, function(a){
            return pad(a);
        });

        return str;
      },
      type: 'text'
    });

    $.tablesorter.addParser({
        id: 'yesno',
        is: function(s) {
            return false;
        },
        format: function(s) {
            return s.toLowerCase().trim() === gettext('yes') ? 1 : 0;
        },
        type: 'text'
    });

    function pad(num) {
      var s = '00000' + num;
      return s.substr(s.length-5);
    }
    $(_LongQuestionXBlock.SELECTOR.SUBMISSIONS).tablesorter({
        headers: {
          2: { sorter: "alphanum" },
          3: { sorter: "alphanum" },
          4: { sorter: "yesno" },
          7: { sorter: "alphanum" }
        }
    });
    $(_LongQuestionXBlock.SELECTOR.SUBMISSIONS).trigger("update");
    var sorting = [[4,1], [1,0]];
    $(_LongQuestionXBlock.SELECTOR.SUBMISSIONS).trigger("sorton",[sorting]);
}

LongQuestionXBlock.prototype.isStaff = function (){
    var _LongQuestionXBlock = this;
    return _LongQuestionXBlock.ELEMENT.LQ_BLOCK.attr('data-staff') === 'True';
}

LongQuestionXBlock.prototype.handleViewSubmission = function (event){
    var _LongQuestionXBlock = this;
    var row = $(event.target).parents("tr");
    $(_LongQuestionXBlock.SELECTOR.VIEW_STUDENT_SUBMISSION).html("Loading ... ");
    $.post(_LongQuestionXBlock.URL.GET_STUDENT_SUBMISSION, {
        student_id: row.data('student_id'),
    })
    .success(function(state){
        if (state && state.submission) {
            $(_LongQuestionXBlock.SELECTOR.VIEW_STUDENT_SUBMISSION)
            .html(state.submission.student_answer);
        }
    });
}

LongQuestionXBlock.prototype.handleGradeEntry = function (e) {
    var _LongQuestionXBlock = this;
    var row = $(e.target).parents("tr");
    var form = _LongQuestionXBlock.ELEMENT.ENTER_GRADE_FORM;
    _LongQuestionXBlock.ELEMENT.STUDENT_NAME.text(row.data('fullname'));
    _LongQuestionXBlock.ELEMENT.MODULE_ID_INPUT.val(row.data('module_id'));
    _LongQuestionXBlock.ELEMENT.SUBMISSION_ID_INPUT.val(row.data('submission_id'));
    _LongQuestionXBlock.ELEMENT.GRADE_INPUT.val(row.data('score'));
    _LongQuestionXBlock.ELEMENT.COMMENT_INPUT.text(row.data('comment'));

    form.off('submit').on('submit', function(event) {
        event.preventDefault();
        var max_score = row.parents(_LongQuestionXBlock.SELECTOR.GRADE_INFO).data('max_score');
        var score = Number(_LongQuestionXBlock.ELEMENT.GRADE_INPUT.val());

        if (!score) {
            _LongQuestionXBlock.gradeFormError('<br/>'+gettext('Grade must be a number.'));
        } else if (score !== parseInt(score)) {
            _LongQuestionXBlock.gradeFormError('<br/>'+gettext('Grade must be an integer.'));
        } else if (score < 0) {
            _LongQuestionXBlock.gradeFormError('<br/>'+gettext('Grade must be positive.'));
        } else if (score > max_score) {
            _LongQuestionXBlock.gradeFormError('<br/>'+interpolate(gettext('Maximum score is %(max_score)s'), {max_score:max_score}, true));
        } else {
            // No errors
            $.post(_LongQuestionXBlock.URL.ENTER_GRADE, form.serialize())
            .success(function(response){
                _LongQuestionXBlock.STATE.STAFF_GRADING_DATA = response;
                _LongQuestionXBlock.renderStaffGrading(response);
            });
        }
    });

    form.find(_LongQuestionXBlock.SELECTOR.REMOVE_GRADE).off('click').on('click', function(event) {
        var url = _LongQuestionXBlock.URL.REMOVE_GRADE +
        '?module_id=' + row.data('module_id') +
        '&student_id=' + row.data('student_id');
        event.preventDefault();

        if (row.data('score')) {
          $.get(url).success(function(response) {
              _LongQuestionXBlock.STATE.STAFF_GRADING_DATA = response;
              _LongQuestionXBlock.renderStaffGrading(response);
          });
        } else {
            _LongQuestionXBlock.gradeFormError('<br/>'+gettext('No grade to remove.'));
        }
    });
}

LongQuestionXBlock.prototype.gradeFormError = function (error) {
    var _LongQuestionXBlock = this;
    _LongQuestionXBlock.ELEMENT.ENTER_GRADE_FORM.find('.error').html(error);
}
