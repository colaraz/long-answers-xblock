/* Javascript for LongAnswerXBlock. */
function LongAnswerXBlock(runtime, element) {
    var _LongAnswerXBlock = this;
    _LongAnswerXBlock.STATE = {
        STAFF_GRADING_DATA: null,
    };

    _LongAnswerXBlock.CKCONFIG = {
        removeButtons: 'About,Cut,Copy,Paste,PasteText,PasteFromWord,Anchor',
        removePlugins: 'wsc,scayt,sourcearea,tableselection,tabletools,contextmenu',
    }

    _LongAnswerXBlock.URL = {
        SAVE_ASSIGNMENT: runtime.handlerUrl(element, 'save_assignment'),
        GET_STUDENT_STATE: runtime.handlerUrl(element, 'get_student_state'),
        SUBMIT_ASSIGNMENT: runtime.handlerUrl(element, 'submit_assignment'),
        GET_STAFF_GRADING: runtime.handlerUrl(element, 'get_staff_grading_data'),
        ENTER_GRADE: runtime.handlerUrl(element, 'enter_grade'),
        REMOVE_GRADE: runtime.handlerUrl(element, 'remove_grade'),
        GET_STUDENT_SUBMISSION: runtime.handlerUrl(element, 'get_student_submission'),
    };

    _LongAnswerXBlock.TEMPLATE = {
        LQ_TEMPLATE: null,
        LQ_GRADING_TEMPLATE: null,
    };

    _LongAnswerXBlock.SELECTOR = {
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
        _LongAnswerXBlock.TEMPLATE.LQ_TEMPLATE = _.template(
            $(_LongAnswerXBlock.SELECTOR.LQ_TEMPLATE, element).text()
        );

        $(function($) {
            _LongAnswerXBlock.init(element);
            if (_LongAnswerXBlock.isStaff(element)) {
                _LongAnswerXBlock.initStaffGrading(element);
            }
        });
    }

    if (require === undefined) {
        xblock($, _);
    } else {
        require(['jquery', 'underscore'], xblock);
    }
}

LongAnswerXBlock.prototype.init = function(element){
    var _LongAnswerXBlock = this;
    $.post(_LongAnswerXBlock.URL.GET_STUDENT_STATE)
    .success(function (response) {
        response.status_message = _LongAnswerXBlock.getStatusMessage(response.submitted);
        _LongAnswerXBlock.render(element, response);
    })
    .fail(function () {
        console.error('Unable to fetch XBlock State')
    });
}

LongAnswerXBlock.prototype.initStaffGrading = function(element){
    var _LongAnswerXBlock = this;

    _LongAnswerXBlock.TEMPLATE.LQ_GRADING_TEMPLATE = _.template(
        $(element).find(_LongAnswerXBlock.SELECTOR.LQ_GRADING_TEMPLATE).text()
    );

    $(_LongAnswerXBlock.SELECTOR.GRADE_SUBMISSION_BUTTON, element)
        .leanModal()
        .on('click', function(event) {
            if(!event.isTrigger){
                $.ajax({
                    url: _LongAnswerXBlock.URL.GET_STAFF_GRADING,
                    success: (function(response) {
                        _LongAnswerXBlock.STATE.STAFF_GRADING_DATA = response;
                        _LongAnswerXBlock.renderStaffGrading(element, response);
                    })
                });
            }else{
                _LongAnswerXBlock.renderStaffGrading(element, _LongAnswerXBlock.STATE.STAFF_GRADING_DATA);
            }
        });

    $(_LongAnswerXBlock.SELECTOR.LQ_BLOCK, element).find('#staff-debug-info-button')
        .leanModal();


    $(_LongAnswerXBlock.SELECTOR.CLOSE_BUTTON, element).on('click', function() {
        setTimeout(function() {
            $(_LongAnswerXBlock.SELECTOR.GRADE_SUBMISSION_BUTTON, element).trigger("click");
            _LongAnswerXBlock.gradeFormError(element, '');
        }, 225);
    });
}

LongAnswerXBlock.prototype.render = function(element, data){
    var _LongAnswerXBlock = this;
    var editorId = "textarea-" + _LongAnswerXBlock.getBlockID(element);
    data.error = data.error || false;
    data.success = data.success || false;

    var content = $(_LongAnswerXBlock.SELECTOR.LQ_CONTENT, element).html(
        _LongAnswerXBlock.TEMPLATE.LQ_TEMPLATE(data)
    );

    var form = $(content).find(_LongAnswerXBlock.SELECTOR.STUDENT_ANSWER_FORM);

    if (form.length) {
        var submitted = data.submitted;
        var student_answer = submitted ? submitted.student_answer: '';
        CKEDITOR.replace(editorId, _LongAnswerXBlock.CKCONFIG).setData(student_answer);
        CKEDITOR.instances[editorId].on('paste', function(evt) {
            evt.cancel();
        });
    }

    $(content).find(_LongAnswerXBlock.SELECTOR.SUBMIT_ASSIGNMENT).off('click').on('click', function() {
        CKEDITOR.instances[editorId].updateElement();
        var submitAnswer = true;
        if(CKEDITOR.instances[editorId].getData() === ""){
            if (!confirm('Submit Empty Answer?')) {
                submitAnswer = false;
            }
        }

        if (submitAnswer) {
            $.post(_LongAnswerXBlock.URL.SUBMIT_ASSIGNMENT, form.serialize())
            .success(function (data) {
                data.status_message = _LongAnswerXBlock.getStatusMessage(data.submitted);
                _LongAnswerXBlock.render(element, data);
            })
            .fail(function (data) {
                data.error = gettext('Submission failed. Please contact your course instructor.');
                _LongAnswerXBlock.render(element, data);
            });
        }
    });

    form.off('submit').on('submit', function(event) {
        event.preventDefault();
        CKEDITOR.instances[editorId].updateElement();

        $.post(_LongAnswerXBlock.URL.SAVE_ASSIGNMENT, form.serialize())
        .success(function (data) {
            $(_LongAnswerXBlock.SELECTOR.STATUS_MESSAGE, element).html(_LongAnswerXBlock.getStatusMessage(data.submitted));
            $(_LongAnswerXBlock.SELECTOR.SUCCESS_MESSAGE, element).show();
            setTimeout(function(){
                $(_LongAnswerXBlock.SELECTOR.SUCCESS_MESSAGE, element).hide();
            }, 2000);
        }).fail(function (data) {
            data.error = gettext('Could not save Answer. Please contact your course instructor.');
            _LongAnswerXBlock.render(element, data);
        });
    });

}

LongAnswerXBlock.prototype.renderStaffGrading = function(element, data) {
    var _LongAnswerXBlock = this;

    if (data.hasOwnProperty('error')) {
        _LongAnswerXBlock.gradeFormError(element, data['error']);
    } else {
        _LongAnswerXBlock.gradeFormError(element, '');
        $(_LongAnswerXBlock.SELECTOR.GRADE_MODAL, element).hide();
    }

    if (data.display_name !== '') {
        $(_LongAnswerXBlock.SELECTOR.DISPLAY_NAME, element).html(data.display_name);
    }

    // Render template
    $(_LongAnswerXBlock.SELECTOR.GRADE_INFO, element)
        .html(_LongAnswerXBlock.TEMPLATE.LQ_GRADING_TEMPLATE(data))
        .data(data);

    // Map data to table rows
    var LQ_BLOCK_ELEMENT = $(_LongAnswerXBlock.SELECTOR.LQ_BLOCK, element);
    data.assignments.map(function(assignment) {
        LQ_BLOCK_ELEMENT.find(
            _LongAnswerXBlock.SELECTOR.STUDENT_GRADE_INFO + '-' + assignment.module_id
        ).data(assignment);
    });

    // Set up grade entry modal
    LQ_BLOCK_ELEMENT.find(_LongAnswerXBlock.SELECTOR.ENTER_GRADE_BUTTON)
        .leanModal({closeButton: _LongAnswerXBlock.SELECTOR.CLOSE_BUTTON})
        .on('click', function (e) {
            _LongAnswerXBlock.handleGradeEntry(element, e);
        });

    LQ_BLOCK_ELEMENT.find(_LongAnswerXBlock.SELECTOR.VIEW_SUBMISSION_BUTTON)
        .leanModal({closeButton: _LongAnswerXBlock.SELECTOR.CLOSE_BUTTON})
        .on('click', function(e){
            _LongAnswerXBlock.handleViewSubmission(element, e);
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
    $(_LongAnswerXBlock.SELECTOR.SUBMISSIONS, element).tablesorter({
        headers: {
          2: { sorter: "alphanum" },
          3: { sorter: "alphanum" },
          4: { sorter: "yesno" },
          7: { sorter: "alphanum" }
        }
    });
    $(_LongAnswerXBlock.SELECTOR.SUBMISSIONS, element).trigger("update");
    var sorting = [[4,1], [1,0]];
    $(_LongAnswerXBlock.SELECTOR.SUBMISSIONS, element).trigger("sorton",[sorting]);
}

LongAnswerXBlock.prototype.isStaff = function (element){
    var _LongAnswerXBlock = this;
    return $(_LongAnswerXBlock.SELECTOR.LQ_BLOCK, element).attr('data-staff') === 'True';
}

LongAnswerXBlock.prototype.handleViewSubmission = function (element, event){
    var _LongAnswerXBlock = this;
    var row = $(event.target).parents("tr");
    $(_LongAnswerXBlock.SELECTOR.VIEW_STUDENT_SUBMISSION, element).html("Loading ... ");
    $.post(_LongAnswerXBlock.URL.GET_STUDENT_SUBMISSION, {
        student_id: row.data('student_id'),
    })
    .success(function(state){
        if (state && state.submission) {
            $(_LongAnswerXBlock.SELECTOR.VIEW_STUDENT_SUBMISSION, element)
            .html(state.submission.student_answer);
        }
    });
}

LongAnswerXBlock.prototype.handleGradeEntry = function (element, e) {
    var _LongAnswerXBlock = this;
    var row = $(e.target).parents("tr");
    var form = $(_LongAnswerXBlock.SELECTOR.ENTER_GRADE_FORM, element);
    $(_LongAnswerXBlock.SELECTOR.STUDENT_NAME, element).text(row.data('fullname'));
    $(_LongAnswerXBlock.SELECTOR.MODULE_ID_INPUT, element).val(row.data('module_id'));
    $(_LongAnswerXBlock.SELECTOR.SUBMISSION_ID_INPUT, element).val(row.data('submission_id'));
    $(_LongAnswerXBlock.SELECTOR.GRADE_INPUT, element).val(row.data('score'));
    $(_LongAnswerXBlock.SELECTOR.COMMENT_INPUT, element).val(row.data('comment'));

    form.off('submit').on('submit', function(event) {
        event.preventDefault();
        var max_score = row.parents(_LongAnswerXBlock.SELECTOR.GRADE_INFO, element).data('max_score');
        var score = Number($(_LongAnswerXBlock.SELECTOR.GRADE_INPUT, element).val());

        if (!score && score !== 0) {
            _LongAnswerXBlock.gradeFormError(element, '<br/>'+gettext('Grade must be a number.'));
        } else if (score !== parseInt(score)) {
            _LongAnswerXBlock.gradeFormError(element, '<br/>'+gettext('Grade must be an integer.'));
        } else if (score < 0) {
            _LongAnswerXBlock.gradeFormError(element, '<br/>'+gettext('Grade must be positive.'));
        } else if (score > max_score) {
            _LongAnswerXBlock.gradeFormError(element, '<br/>'+interpolate(gettext('Maximum score is %(max_score)s'), {max_score:max_score}, true));
        } else {
            // No errors
            $.post(_LongAnswerXBlock.URL.ENTER_GRADE, form.serialize())
            .success(function(response){
                _LongAnswerXBlock.STATE.STAFF_GRADING_DATA = response;
                _LongAnswerXBlock.renderStaffGrading(element, response);
            });
        }
    });

    form.find(_LongAnswerXBlock.SELECTOR.REMOVE_GRADE).off('click').on('click', function(event) {
        var url = _LongAnswerXBlock.URL.REMOVE_GRADE +
        '?module_id=' + row.data('module_id') +
        '&student_id=' + row.data('student_id');
        event.preventDefault();

        if (row.data('score')) {
          $.get(url).success(function(response) {
              _LongAnswerXBlock.STATE.STAFF_GRADING_DATA = response;
              _LongAnswerXBlock.renderStaffGrading(element, response);
          });
        } else {
            _LongAnswerXBlock.gradeFormError(element, '<br/>'+gettext('No grade to remove.'));
        }
    });
}

LongAnswerXBlock.prototype.gradeFormError = function (element, error) {
    var _LongAnswerXBlock = this;
    $(_LongAnswerXBlock.SELECTOR.ENTER_GRADE_FORM, element).find('.error').html(error);
}

LongAnswerXBlock.prototype.getStatusMessage = function(submitted){
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

LongAnswerXBlock.prototype.getBlockID = function(element){
    var _LongAnswerXBlock = this;
    return $(_LongAnswerXBlock.SELECTOR.LQ_BLOCK, element).attr('data-id');
}
