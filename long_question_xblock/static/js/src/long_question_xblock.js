/* Javascript for LongQuestionXBlock. */
function LongQuestionXBlock(runtime, element) {
    var _LongQuestionXBlock = this;
    _LongQuestionXBlock.STATE = {
        STAFF_GRADING_DATA: null,
    };

    _LongQuestionXBlock.CKCONFIG = {
        removeButtons: 'About,Cut,Copy,Paste,PasteText,PasteFromWord,Anchor',
        removePlugins: 'wsc,scayt,sourcearea,tableselection,tabletools,contextmenu',
    }

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
        MODULE_ID_INPUT: '#module_id-input',
        REMOVE_GRADE: '#remove-grade',
        STATUS_MESSAGE: '.sequential-status-message p b',
        STUDENT_NAME: '#student-name',
        STUDENT_ANSWER_FORM: '#student-answer-form',
        STUDENT_GRADE_INFO: '#grade-info #row',
        SUBMIT_ASSIGNMENT: '.finalize-upload',
        SUBMISSIONS: '#submissions',
        SUBMISSION_ID_INPUT: '#submission_id-input',
        SUCCESS_MESSAGE: '.success-message',
        GRADE_INFO: '#grade-info',
        GRADE_INPUT: '#grade-input',
        GRADE_MODAL: '.grade-modal',
        GRADE_SUBMISSION_BUTTON: '#grade-submissions-button',
        VIEW_STUDENT_SUBMISSION: '.student-submission',
        VIEW_SUBMISSION_BUTTON: '.view-submission-button',
        CLOSE_BUTTON: '.close-button',
    }

    function xblock($, _) {
        _LongQuestionXBlock.TEMPLATE.LQ_TEMPLATE = _.template(
            $(_LongQuestionXBlock.SELECTOR.LQ_TEMPLATE, element).text()
        );

        $(function($) {
            _LongQuestionXBlock.init(element);
            if (_LongQuestionXBlock.isStaff(element)) {
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

LongQuestionXBlock.prototype.init = function(element){
    var _LongQuestionXBlock = this;
    $.post(_LongQuestionXBlock.URL.GET_STUDENT_STATE)
    .success(function (response) {
        response.status_message = _LongQuestionXBlock.getStatusMessage(response.submitted);
        _LongQuestionXBlock.render(element, response);
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

    $(_LongQuestionXBlock.SELECTOR.GRADE_SUBMISSION_BUTTON, element)
        .leanModal()
        .on('click', function(event) {
            if(!event.isTrigger){
                $.ajax({
                    url: _LongQuestionXBlock.URL.GET_STAFF_GRADING,
                    success: (function(response) {
                        _LongQuestionXBlock.STATE.STAFF_GRADING_DATA = response;
                        _LongQuestionXBlock.renderStaffGrading(element, response);
                    })
                });
            }else{
                _LongQuestionXBlock.renderStaffGrading(element, _LongQuestionXBlock.STATE.STAFF_GRADING_DATA);
            }
        });

    $(_LongQuestionXBlock.SELECTOR.LQ_BLOCK, element).find('#staff-debug-info-button')
        .leanModal();


    $(_LongQuestionXBlock.SELECTOR.CLOSE_BUTTON, element).on('click', function() {
        setTimeout(function() {
            $(_LongQuestionXBlock.SELECTOR.GRADE_SUBMISSION_BUTTON, element).trigger("click");
            _LongQuestionXBlock.gradeFormError(element, '');
        }, 225);
    });
}

LongQuestionXBlock.prototype.render = function(element, data){
    var _LongQuestionXBlock = this;
    var editorId = "textarea-" + _LongQuestionXBlock.getBlockID(element);
    data.error = data.error || false;
    data.success = data.success || false;

    var content = $(_LongQuestionXBlock.SELECTOR.LQ_CONTENT, element).html(
        _LongQuestionXBlock.TEMPLATE.LQ_TEMPLATE(data)
    );

    var form = $(content).find(_LongQuestionXBlock.SELECTOR.STUDENT_ANSWER_FORM);

    if (form.length) {
        var submitted = data.submitted;
        var student_answer = submitted ? submitted.student_answer: '';
        CKEDITOR.replace(editorId, _LongQuestionXBlock.CKCONFIG).setData(student_answer);
        CKEDITOR.instances[editorId].on('paste', function(evt) {
            evt.cancel();
        });
    }

    $(content).find(_LongQuestionXBlock.SELECTOR.SUBMIT_ASSIGNMENT).off('click').on('click', function() {
        CKEDITOR.instances[editorId].updateElement();

        $.post(_LongQuestionXBlock.URL.SUBMIT_ASSIGNMENT, form.serialize())
        .success(function (data) {
            data.status_message = _LongQuestionXBlock.getStatusMessage(data.submitted);
            _LongQuestionXBlock.render(element, data);
        })
        .fail(function (data) {
            data.error = gettext('Submission failed. Please contact your course instructor.');
            _LongQuestionXBlock.render(element, data);
        });
    });

    form.off('submit').on('submit', function(event) {
        event.preventDefault();
        CKEDITOR.instances[editorId].updateElement();

        $.post(_LongQuestionXBlock.URL.SAVE_ASSIGNMENT, form.serialize())
        .success(function (data) {
            $(_LongQuestionXBlock.SELECTOR.STATUS_MESSAGE, element).html(_LongQuestionXBlock.getStatusMessage(data.submitted));
            $(_LongQuestionXBlock.SELECTOR.SUCCESS_MESSAGE, element).show();
            setTimeout(function(){
                $(_LongQuestionXBlock.SELECTOR.SUCCESS_MESSAGE, element).hide();
            }, 2000);
        }).fail(function (data) {
            data.error = gettext('Could not save Answer. Please contact your course instructor.');
            _LongQuestionXBlock.render(element, data);
        });
    });

}

LongQuestionXBlock.prototype.renderStaffGrading = function(element, data) {
    var _LongQuestionXBlock = this;

    if (data.hasOwnProperty('error')) {
        _LongQuestionXBlock.gradeFormError(element, data['error']);
    } else {
        _LongQuestionXBlock.gradeFormError(element, '');
        $(_LongQuestionXBlock.SELECTOR.GRADE_MODAL, element).hide();
    }

    if (data.display_name !== '') {
        $(_LongQuestionXBlock.SELECTOR.DISPLAY_NAME, element).html(data.display_name);
    }

    // Render template
    $(_LongQuestionXBlock.SELECTOR.GRADE_INFO, element)
        .html(_LongQuestionXBlock.TEMPLATE.LQ_GRADING_TEMPLATE(data))
        .data(data);

    // Map data to table rows
    var LQ_BLOCK_ELEMENT = $(_LongQuestionXBlock.SELECTOR.LQ_BLOCK, element);
    data.assignments.map(function(assignment) {
        LQ_BLOCK_ELEMENT.find(
            _LongQuestionXBlock.SELECTOR.STUDENT_GRADE_INFO + '-' + assignment.module_id
        ).data(assignment);
    });

    // Set up grade entry modal
    LQ_BLOCK_ELEMENT.find(_LongQuestionXBlock.SELECTOR.ENTER_GRADE_BUTTON)
        .leanModal({closeButton: _LongQuestionXBlock.SELECTOR.CLOSE_BUTTON})
        .on('click', function (e) {
            _LongQuestionXBlock.handleGradeEntry(element, e);
        });

    LQ_BLOCK_ELEMENT.find(_LongQuestionXBlock.SELECTOR.VIEW_SUBMISSION_BUTTON)
        .leanModal({closeButton: _LongQuestionXBlock.SELECTOR.CLOSE_BUTTON})
        .on('click', function(e){
            _LongQuestionXBlock.handleViewSubmission(element, e);
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
    $(_LongQuestionXBlock.SELECTOR.SUBMISSIONS, element).tablesorter({
        headers: {
          2: { sorter: "alphanum" },
          3: { sorter: "alphanum" },
          4: { sorter: "yesno" },
          7: { sorter: "alphanum" }
        }
    });
    $(_LongQuestionXBlock.SELECTOR.SUBMISSIONS, element).trigger("update");
    var sorting = [[4,1], [1,0]];
    $(_LongQuestionXBlock.SELECTOR.SUBMISSIONS, element).trigger("sorton",[sorting]);
}

LongQuestionXBlock.prototype.isStaff = function (element){
    var _LongQuestionXBlock = this;
    return $(_LongQuestionXBlock.SELECTOR.LQ_BLOCK, element).attr('data-staff') === 'True';
}

LongQuestionXBlock.prototype.handleViewSubmission = function (element, event){
    var _LongQuestionXBlock = this;
    var row = $(event.target).parents("tr");
    $(_LongQuestionXBlock.SELECTOR.VIEW_STUDENT_SUBMISSION, element).html("Loading ... ");
    $.post(_LongQuestionXBlock.URL.GET_STUDENT_SUBMISSION, {
        student_id: row.data('student_id'),
    })
    .success(function(state){
        if (state && state.submission) {
            $(_LongQuestionXBlock.SELECTOR.VIEW_STUDENT_SUBMISSION, element)
            .html(state.submission.student_answer);
        }
    });
}

LongQuestionXBlock.prototype.handleGradeEntry = function (element, e) {
    var _LongQuestionXBlock = this;
    var row = $(e.target).parents("tr");
    var form = $(_LongQuestionXBlock.SELECTOR.ENTER_GRADE_FORM, element);
    $(_LongQuestionXBlock.SELECTOR.STUDENT_NAME, element).text(row.data('fullname'));
    $(_LongQuestionXBlock.SELECTOR.MODULE_ID_INPUT, element).val(row.data('module_id'));
    $(_LongQuestionXBlock.SELECTOR.SUBMISSION_ID_INPUT, element).val(row.data('submission_id'));
    $(_LongQuestionXBlock.SELECTOR.GRADE_INPUT, element).val(row.data('score'));
    $(_LongQuestionXBlock.SELECTOR.COMMENT_INPUT, element).text(row.data('comment'));

    form.off('submit').on('submit', function(event) {
        event.preventDefault();
        var max_score = row.parents(_LongQuestionXBlock.SELECTOR.GRADE_INFO, element).data('max_score');
        var score = Number($(_LongQuestionXBlock.SELECTOR.GRADE_INPUT, element).val());

        if (!score) {
            _LongQuestionXBlock.gradeFormError(element, '<br/>'+gettext('Grade must be a number.'));
        } else if (score !== parseInt(score)) {
            _LongQuestionXBlock.gradeFormError(element, '<br/>'+gettext('Grade must be an integer.'));
        } else if (score < 0) {
            _LongQuestionXBlock.gradeFormError(element, '<br/>'+gettext('Grade must be positive.'));
        } else if (score > max_score) {
            _LongQuestionXBlock.gradeFormError(element, '<br/>'+interpolate(gettext('Maximum score is %(max_score)s'), {max_score:max_score}, true));
        } else {
            // No errors
            $.post(_LongQuestionXBlock.URL.ENTER_GRADE, form.serialize())
            .success(function(response){
                _LongQuestionXBlock.STATE.STAFF_GRADING_DATA = response;
                _LongQuestionXBlock.renderStaffGrading(element, response);
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
              _LongQuestionXBlock.renderStaffGrading(element, response);
          });
        } else {
            _LongQuestionXBlock.gradeFormError(element, '<br/>'+gettext('No grade to remove.'));
        }
    });
}

LongQuestionXBlock.prototype.gradeFormError = function (element, error) {
    var _LongQuestionXBlock = this;
    $(_LongQuestionXBlock.SELECTOR.ENTER_GRADE_FORM, element).find('.error').html(error);
}

LongQuestionXBlock.prototype.getStatusMessage = function(submitted){
    var status_message = gettext('');
    if (submitted) {
        if (submitted.finalized) {
            status_message = gettext('Submitted');
        }
        else{
            status_message = gettext('Your answer has not been submitted yet. Click submit to finalize your submission.');
        }
    }
    else{
        status_message = gettext('Click Submit to instantly submit your solution. By clicking Save you will be able to submit your answer later.');
    }
    return status_message;
}

LongQuestionXBlock.prototype.getBlockID = function(element){
    var _LongQuestionXBlock = this;
    return $(_LongQuestionXBlock.SELECTOR.LQ_BLOCK, element).attr('data-id');
}
