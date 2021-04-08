/* Javascript for StaffGradedAssignmentXBlock. */
function StaffGradedAssignmentXBlock(runtime, element) {
    function xblock($, _) {
        var uploadUrl = runtime.handlerUrl(element, 'upload_assignment');
        var getStudentState = runtime.handlerUrl(element, 'get_student_state');
        var finalizeUploadUrl = runtime.handlerUrl(element, 'finalize_uploaded_assignment');
        var getStaffGradingUrl = runtime.handlerUrl(element, 'get_staff_grading_data');
        var enterGradeUrl = runtime.handlerUrl(element, 'enter_grade');
        var removeGradeUrl = runtime.handlerUrl(element, 'remove_grade');
        var getStudentSubmission = runtime.handlerUrl(element, 'get_student_submission');
        var template = _.template($(element).find("#sga-tmpl").text());
        var gradingTemplate;

        function render(state) {
            state.error = state.error || false;
            state.success = state.success || false;
            var content = $(element).find('#sga-content').html(template(state));
            var form = $(element).find("#student-answer-form");

            if (form.length) {
                var uploaded = state.uploaded;
                var student_answer = uploaded ? uploaded.student_answer: '';
                CKEDITOR.replace("assignment_answer").setData(student_answer);
            }

            $(content).find('.finalize-upload').on('click', function() {
                for(var instanceName in CKEDITOR.instances){
                    CKEDITOR.instances[instanceName].updateElement();
                }
                $.post(
                    finalizeUploadUrl,
                    form.serialize()
                ).success(
                    function (state) {
                        render(state);
                    }
                ).fail(
                    function () {
                        state.error = gettext('Submission failed. Please contact your course instructor.');
                        render(state);
                    }
                );
            });

            form.off('submit').on('submit', function(event) {
                event.preventDefault();
                for(var instanceName in CKEDITOR.instances){
                    CKEDITOR.instances[instanceName].updateElement();
                }
                $.post(
                    uploadUrl,
                    form.serialize()
                ).success(
                    function (state) {
                        state.success = gettext('Answer saved successfully.')
                        render(state);
                        setTimeout(function(){
                            $('#success-message').hide()
                        }, 3000)
                    }
                ).fail(
                    function (state) {
                        state.error = gettext('Could not save Draft. Please contact your course instructor.');
                        render(state);
                    }
                );
            });
        }

        function renderStaffGrading(data) {
            if (data.hasOwnProperty('error')) {
              gradeFormError(data['error']);
            } else {
              gradeFormError('');
              $('.grade-modal').hide();
            }

            if (data.display_name !== '') {
                $('.sga-block .display_name').html(data.display_name);
            }

            // Render template
            $(element).find('#grade-info')
                .html(gradingTemplate(data))
                .data(data);

            // Map data to table rows
            data.assignments.map(function(assignment) {
              $(element).find('#grade-info #row-' + assignment.module_id).data(assignment);
            });

            // Set up grade entry modal
            $(element).find('.enter-grade-button')
                .leanModal({closeButton: '#enter-grade-cancel'})
                .on('click', handleGradeEntry);

            $(element).find('.view-submission-button')
                .leanModal({closeButton: '#view-submission-cancel'})
                .on('click', handleViewSubmission);

            $(element).find('#view-submission-cancel').on('click', function() {
                setTimeout(function() {
                    $('#grade-submissions-button').click();
                }, 225);
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
            $("#submissions").tablesorter({
                headers: {
                  2: { sorter: "alphanum" },
                  3: { sorter: "alphanum" },
                  4: { sorter: "yesno" },
                  7: { sorter: "alphanum" }
                }
            });
            $("#submissions").trigger("update");
            var sorting = [[4,1], [1,0]];
            $("#submissions").trigger("sorton",[sorting]);
        }

        function isStaff() {
          return $(element).find('.sga-block').attr('data-staff') === 'True';
        }

        /* Just show error on enter grade dialog */
        function gradeFormError(error) {
            var form = $(element).find("#enter-grade-form");
            form.find('.error').html(error);
        }

        function handleViewSubmission(){
            var row = $(this).parents("tr");
            $.post(getStudentSubmission, {
                student_id: row.data('student_id'),
            }).success(
                function(state){
                    if (state.submission) {
                        $('#student-submission').html(state.submission.student_answer);
                    }
                }
            );
        }

        /* Click event handler for "enter grade" */
        function handleGradeEntry() {
            var row = $(this).parents("tr");
            var form = $(element).find("#enter-grade-form");
            $(element).find('#student-name').text(row.data('fullname'));
            form.find('#module_id-input').val(row.data('module_id'));
            form.find('#submission_id-input').val(row.data('submission_id'));
            form.find('#grade-input').val(row.data('score'));
            form.find('#comment-input').text(row.data('comment'));
            form.off('submit').on('submit', function(event) {
                var max_score = row.parents('#grade-info').data('max_score');
                var score = Number(form.find('#grade-input').val());
                event.preventDefault();
                if (!score) {
                    gradeFormError('<br/>'+gettext('Grade must be a number.'));
                } else if (score !== parseInt(score)) {
                    gradeFormError('<br/>'+gettext('Grade must be an integer.'));
                } else if (score < 0) {
                    gradeFormError('<br/>'+gettext('Grade must be positive.'));
                } else if (score > max_score) {
                    gradeFormError('<br/>'+interpolate(gettext('Maximum score is %(max_score)s'), {max_score:max_score}, true));
                } else {
                    // No errors
                    $.post(enterGradeUrl, form.serialize())
                        .success(renderStaffGrading);
                }
            });
            form.find('#remove-grade').on('click', function(event) {
                var url = removeGradeUrl + '?module_id=' +
                    row.data('module_id') + '&student_id=' +
                    row.data('student_id');
                event.preventDefault();
                if (row.data('score')) {
                  // if there is no grade then it is pointless to call api.
                  $.get(url).success(renderStaffGrading);
                } else {
                    gradeFormError('<br/>'+gettext('No grade to remove.'));
                }
            });
            form.find('#enter-grade-cancel').on('click', function() {
                /* We're kind of stretching the limits of leanModal, here,
                 * by nesting modals one on top of the other.  One side effect
                 * is that when the enter grade modal is closed, it hides
                 * the overlay for itself and for the staff grading modal,
                 * so the overlay is no longer present to click on to close
                 * the staff grading modal.  Since leanModal uses a fade out
                 * time of 200ms to hide the overlay, our work around is to
                 * wait 225ms and then just "click" the 'Grade Submissions'
                 * button again.  It would also probably be pretty
                 * straightforward to submit a patch to leanModal so that it
                 * would work properly with nested modals.
                 *
                 * See: https://github.com/mitodl/edx-sga/issues/13
                 */
                setTimeout(function() {
                    $('#grade-submissions-button').click();
                    gradeFormError('');
                }, 225);
            });
        }

        $(function($) {
            var block = $(element).find('.sga-block');
            $.post(
                getStudentState,
            ).success(
                function (state) {
                  render(state);
                }
            ).fail(
                function () {
                  console.error('Unable to fetch XBlock state')
                }
            );

            var is_staff = isStaff();
            if (is_staff) {
                gradingTemplate = _.template(
                    $(element).find('#sga-grading-tmpl').text());
                block.find('#grade-submissions-button')
                    .leanModal()
                    .on('click', function() {
                        $.ajax({
                            url: getStaffGradingUrl,
                            success: renderStaffGrading
                        });
                    });
                block.find('#staff-debug-info-button')
                    .leanModal();
            }
        });

    }

    function loadjs(url) {
        $('<script>')
            .attr('type', 'text/javascript')
            .attr('src', url)
            .appendTo(element);
    }
    if (require === undefined) {
        /**
         * The LMS does not use require.js (although it loads it...) and
         * does not already load jquery.fileupload.  (It looks like it uses
         * jquery.ajaxfileupload instead.  But our XBlock uses
         * jquery.fileupload.
         */
        loadjs('/static/js/vendor/jQuery-File-Upload/js/jquery.iframe-transport.js');
        loadjs('/static/js/vendor/jQuery-File-Upload/js/jquery.fileupload.js');
        xblock($, _);
    } else {
        /**
         * Studio, on the other hand, uses require.js and already knows about
         * jquery.fileupload.
         */
        require(['jquery', 'underscore', 'jquery.fileupload'], xblock);
    }
}
