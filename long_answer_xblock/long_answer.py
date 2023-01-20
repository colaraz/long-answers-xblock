"""
This block defines a Long Question. Students are shown a Text Editor
in which they can write their answer and submit it which is then graded by staff.
"""
import json
import logging
import mimetypes
import os
import urllib

import pkg_resources
import pytz
from courseware.models import StudentModule  # lint-amnesty, pylint: disable=import-error
from django.conf import settings  # lint-amnesty, pylint: disable=import-error
from django.core.exceptions import PermissionDenied  # lint-amnesty, pylint: disable=import-error
from django.core.files import File  # lint-amnesty, pylint: disable=import-error
from django.core.files.storage import default_storage  # lint-amnesty, pylint: disable=import-error
from django.template import Context, Template  # lint-amnesty, pylint: disable=import-error
from django.utils.encoding import force_text  # pylint: disable=import-error
from django.utils.timezone import now as django_now  # pylint: disable=import-error
from django.utils.translation import ugettext_lazy as _  # pylint: disable=import-error
from safe_lxml import etree  # pylint: disable=import-error
from student.models import user_by_anonymous_id  # lint-amnesty, pylint: disable=import-error
from submissions import api as submissions_api  # lint-amnesty, pylint: disable=import-error
from submissions.models import (
    Submission,
    StudentItem as SubmissionsStudent
)  # lint-amnesty, pylint: disable=import-error
from webob.response import Response
from xblock.core import XBlock  # lint-amnesty, pylint: disable=import-error
from xblock.exceptions import JsonHandlerError  # lint-amnesty, pylint: disable=import-error
from xblock.fields import DateTime, Scope, String, Float, Integer  # lint-amnesty, pylint: disable=import-error
from web_fragments.fragment import Fragment  # lint-amnesty, pylint: disable=import-error
from xblockutils.studio_editable import StudioEditableXBlockMixin
from xmodule.util.duedate import get_extended_due_date  # lint-amnesty, pylint: disable=import-error
from xmodule.contentstore.content import StaticContent

from long_answer_xblock.constants import ITEM_TYPE
from long_answer_xblock.showanswer import ShowAnswerXBlockMixin

from long_answer_xblock.utils import (
    utcnow,
    is_finalized_submission
)

log = logging.getLogger(__name__)


def reify(meth):
    """
    Decorator which caches value so it is only computed once.
    Keyword arguments:
    inst
    """
    def getter(inst):
        """
        Set value to meth name in dict and returns value.
        """
        value = meth(inst)
        inst.__dict__[meth.__name__] = value
        return value
    return property(getter)


class LongAnswerXBlock(StudioEditableXBlockMixin, ShowAnswerXBlockMixin, XBlock):
    """
    This block defines a Long Answer XBlock. Students are shown a rich format text editor
    in which they can write their answers to the given question
    """
    has_score = True
    icon_class = 'problem'
    editable_fields = ('display_name', 'question', 'points', 'weight', 'showanswer', 'solution')

    question = String(
        help=_("Question to show to the user"),
        display_name=_("Question"),
        scope=Scope.settings,
        multiline_editor='html',
        resettable_editor=False,
        default='',
    )

    display_name = String(
        display_name=_("Display Name"),
        default=_('Long Answer'),
        scope=Scope.settings,
        help=_("This name appears in the horizontal navigation at the top of "
               "the page.")
    )

    weight = Float(
        display_name=_("Problem Weight"),
        help=_("Defines the number of points each problem is worth. "
               "If the value is not set, the problem is worth the sum of the "
               "option point values."),
        values={"min": 0, "step": .1},
        scope=Scope.settings
    )

    points = Integer(
        display_name=_("Maximum score"),
        help=_("Maximum grade score given to assignment by staff."),
        default=100,
        scope=Scope.settings
    )

    staff_score = Integer(
        display_name=_("Score assigned by non-instructor staff"),
        help=_("Score will need to be approved by instructor before being "
               "published."),
        default=None,
        scope=Scope.settings
    )

    comment = String(
        display_name=_("Instructor comment"),
        default='',
        scope=Scope.user_state,
        help=_("Feedback given to student by instructor.")
    )


    student_answer = String(
        display_name=_("Answer"),
        scope=Scope.user_state,
        default=None,
        help=_("Student answer to the question")
    )

    @classmethod
    def parse_xml(cls, node, runtime, keys, id_generator):
        """
        Override default serialization to handle <solution /> elements
        """
        block = runtime.construct_xblock_from_class(cls, keys)

        for child in node:
            if child.tag == "solution":
                # convert child elements of <solution> into HTML for display
                block.solution = ''.join(etree.tostring(subchild) for subchild in child)

        # Attributes become fields.
        # Note that a solution attribute here will override any solution XML element
        for name, value in node.items():  # lxml has no iteritems
            cls._set_field_if_present(block, name, value, {})

        return block

    def add_xml_to_node(self, node):
        """
        Override default serialization to output solution field as a separate child element.
        """
        super(LongAnswerXBlock, self).add_xml_to_node(node)

        if 'solution' in node.attrib:
            # Try outputting it as an XML element if we can
            solution = node.attrib['solution']
            wrapped = "<solution>{}</solution>".format(solution)
            try:
                child = etree.fromstring(wrapped)
            except:  # pylint: disable=bare-except
                # Parsing exception, leave the solution as an attribute
                pass
            else:
                node.append(child)
                del node.attrib['solution']

    @XBlock.json_handler
    def save_sga(self, data, suffix=''):
        # pylint: disable=unused-argument
        """
        Persist block data when updating settings in studio.
        """
        self.display_name = data.get('display_name', self.display_name)

        # Validate points before saving
        points = data.get('points', self.points)
        # Check that we are an int
        try:
            points = int(points)
        except ValueError:
            raise JsonHandlerError(400, 'Points must be an integer')
        # Check that we are positive
        if points < 0:
            raise JsonHandlerError(400, 'Points must be a positive integer')
        self.points = points

        # Validate weight before saving
        weight = data.get('weight', self.weight)
        # Check that weight is a float.
        if weight:
            try:
                weight = float(weight)
            except ValueError:
                raise JsonHandlerError(400, 'Weight must be a decimal number')
            # Check that we are positive
            if weight < 0:
                raise JsonHandlerError(
                    400, 'Weight must be a positive decimal number'
                )
        self.weight = weight

    @XBlock.handler
    def save_assignment(self, request, suffix=''):
        # pylint: disable=unused-argument, protected-access
        """
        Save a students submission.
        """
        require(self.upload_allowed())
        user = self.get_real_user()
        require(user)
        assignment_answer = request.params['assignment_answer']
        # Uploading an assignment represents a change of state with this user in this block,
        # so we need to ensure that the user has a StudentModule record, which represents that state.
        self.get_or_create_student_module(user)
        answer = {
            "student_answer": assignment_answer,
            "finalized": False
        }
        student_item_dict = self.get_student_item_dict()
        self.create_or_update_submission(student_item_dict, answer)
        return Response(json_body=self.student_state())

    @XBlock.handler
    def submit_assignment(self, request, suffix=''):
        # pylint: disable=unused-argument
        """
        Finalize a student's submission. This prevents further uploads for the
        given block, and makes the submission available to instructors for grading
        """
        submission_data = self.get_submission()
        require(self.upload_allowed())
        if submission_data is None:
            user = self.get_real_user()
            require(user)
            assignment_answer = request.params['assignment_answer']
            self.get_or_create_student_module(user)
            answer = {
                "student_answer": assignment_answer,
                "finalized": True
            }
            student_item_dict = self.get_student_item_dict()
            submissions_api.create_submission(student_item_dict, answer)
        else:
            # Editing the Submission record directly since the API doesn't support it
            submission = Submission.objects.get(uuid=submission_data['uuid'])
            if not submission.answer.get('finalized'):
                if request.params.get('assignment_answer'):
                    submission.answer['student_answer'] = request.params['assignment_answer']
                submission.answer['finalized'] = True
                submission.submitted_at = django_now()
                submission.save()
        return Response(json_body=self.student_state())


    @XBlock.handler
    def get_student_state(self, request, suffix=''):
        return Response(json_body=self.student_state())

    @XBlock.handler
    def get_staff_grading_data(self, request, suffix=''):
        # pylint: disable=unused-argument
        """
        Return the html for the staff grading view
        """
        require(self.is_course_staff())
        return Response(json_body=self.staff_grading_data())

    @XBlock.handler
    def get_student_submission(self, request, suffix=''):
        require(self.is_course_staff())
        student_id = request.params.get('student_id')
        submission = self.get_submission(student_id)
        return Response(json_body={'submission': submission['answer']})

    @XBlock.handler
    def enter_grade(self, request, suffix=''):
        # pylint: disable=unused-argument
        """
        Persist a score for a student given by staff.
        """
        require(self.is_course_staff())
        score = request.params.get('grade', None)
        module = self.get_student_module(request.params['module_id'])
        if not score:
            return Response(
                json_body=self.validate_score_message(
                    module.course_id,
                    module.student.username
                )
            )

        state = json.loads(module.state)
        try:
            score = int(score)
        except ValueError:
            return Response(
                json_body=self.validate_score_message(
                    module.course_id,
                    module.student.username
                )
            )
        if self.is_instructor():
            uuid = request.params['submission_id']
            submissions_api.set_score(uuid, score, self.max_score())
        else:
            state['staff_score'] = score
        state['comment'] = request.params.get('comment', '')
        state['score'] = {'raw_earned': score, 'raw_possible': self.max_score()}
        module.state = json.dumps(state)
        module.save()
        log.info(
            "enter_grade for course:%s module:%s student:%s",
            module.course_id,
            module.module_state_key,
            module.student.username
        )

        return Response(json_body=self.staff_grading_data())

    @XBlock.handler
    def remove_grade(self, request, suffix=''):
        # pylint: disable=unused-argument
        """
        Reset a students score request by staff.
        """
        require(self.is_course_staff())
        student_id = request.params['student_id']
        submissions_api.reset_score(
            student_id,
            self.block_course_id,
            self.block_id
        )
        module = self.get_student_module(request.params['module_id'])
        state = json.loads(module.state)
        state['staff_score'] = None
        state['comment'] = ''
        state['student_answer'] = ''
        module.state = json.dumps(state)
        module.save()
        log.info(
            "remove_grade for course:%s module:%s student:%s",
            module.course_id,
            module.module_state_key,
            module.student.username
        )
        return Response(json_body=self.staff_grading_data())

    def student_view(self, context=None):
        # pylint: disable=no-member
        """
        The primary view of the LongAnswerXBlock, shown to students
        when viewing courses.
        """
        context = {
            "student_state": json.dumps(self.student_state()),
            "id": self.location.block_id.replace('.', '_'),
            "support_email": settings.TECH_SUPPORT_EMAIL
        }
        if self.show_staff_grading_interface():
            context['is_course_staff'] = True
            self.update_staff_debug_context(context)

        fragment = Fragment()
        fragment.add_content(
            render_template(
                'templates/long_answer_xblock/show.html',
                context
            )
        )
        fragment.add_css(_resource("static/css/long_answer_xblock.css"))
        fragment.add_javascript(_resource("static/js/src/long_answer_xblock.js"))
        fragment.add_javascript(_resource("static/js/src/jquery.tablesorter.min.js"))
        fragment.add_javascript_url('https://cdn.ckeditor.com/4.13.0/standard/ckeditor.js')
        fragment.initialize_js('LongAnswerXBlock', self.student_state())
        return fragment

    def studio_view(self, context=None):  # pylint: disable=useless-super-delegation
        """
        Render a form for editing this XBlock
        """
        # this method only exists to provide context=None for backwards compat
        return super(LongAnswerXBlock, self).studio_view(context)

    def clear_student_state(self, *args, **kwargs):
        # pylint: disable=unused-argument
        """
        For a given user, clears submissions for this XBlock.

        Staff users are able to delete a learner's state for a block in LMS. When that capability is
        used, the block's "clear_student_state" function is called if it exists.
        """
        student_id = kwargs['user_id']
        for submission in submissions_api.get_submissions(
                self.get_student_item_dict(student_id)
        ):
            submissions_api.reset_score(
                student_id,
                self.block_course_id,
                self.block_id,
                clear_state=True
            )

    def max_score(self):
        """
        Return the maximum score possible.
        """
        return self.points

    @reify
    def block_id(self):
        """
        Return the usage_id of the block.
        """
        return unicode(self.scope_ids.usage_id)

    @reify
    def block_course_id(self):
        """
        Return the course_id of the block.
        """
        return unicode(self.course_id)

    def get_student_item_dict(self, student_id=None):
        # pylint: disable=no-member
        """
        Returns dict required by the submissions app for creating and
        retrieving submissions for a particular student.
        """
        if student_id is None:
            student_id = self.xmodule_runtime.anonymous_student_id
            assert student_id != (
                'MOCK', "Forgot to call 'personalize' in test."
            )
        return {
            "student_id": student_id,
            "course_id": self.block_course_id,
            "item_id": self.block_id,
            "item_type": ITEM_TYPE,
        }

    def get_submission(self, student_id=None):
        """
        Get student's most recent submission.
        """
        submissions = submissions_api.get_submissions(
            self.get_student_item_dict(student_id)
        )
        if submissions:
            # If I understand docs correctly, most recent submission should
            # be first
            return submissions[0]

    def create_or_update_submission(self, student_item_dict=None, answer=None):
        submission_data = self.get_submission()

        if not submission_data:
            submissions_api.create_submission(student_item_dict, answer)
        else:
            submission = Submission.objects.get(uuid=submission_data['uuid'])
            submission.answer = answer
            submission.submitted_at = django_now()
            submission.save()

    def get_score(self, student_id=None):
        """
        Return student's current score.
        """
        score = submissions_api.get_score(
            self.get_student_item_dict(student_id)
        )
        if score:
            return score['points_earned']

    @reify
    def score(self):
        """
        Return score from submissions.
        """
        return self.get_score()

    def update_staff_debug_context(self, context):
        # pylint: disable=no-member
        """
        Add context info for the Staff Debug interface.
        """
        published = self.start
        context['is_released'] = published and published < utcnow()
        context['location'] = self.location
        context['category'] = type(self).__name__
        context['fields'] = [
            (name, field.read_from(self))
            for name, field in self.fields.items()]

    def get_student_module(self, module_id):
        """
        Returns a StudentModule that matches the given id

        Args:
            module_id (int): The module id

        Returns:
            StudentModule: A StudentModule object
        """
        return StudentModule.objects.get(pk=module_id)

    def get_or_create_student_module(self, user):
        """
        Gets or creates a StudentModule for the given user for this block

        Returns:
            StudentModule: A StudentModule object
        """
        student_module, created = StudentModule.objects.get_or_create(
            course_id=self.course_id,
            module_state_key=self.location,
            student=user,
            defaults={
                'state': '{}',
                'module_type': self.category,
            }
        )
        if created:
            log.info(
                "Created student module %s [course: %s] [student: %s]",
                student_module.module_state_key,
                student_module.course_id,
                student_module.student.username
            )
        return student_module

    def student_state(self):
        """
        Returns a JSON serializable representation of student's state for
        rendering in client view.
        """
        submission = self.get_submission()
        if submission:
            submitted = submission['answer']
        else:
            submitted = None

        score = self.score
        if score is not None:
            graded = {'score': score, 'comment': force_text(self.comment)}
        else:
            graded = None

        if self.answer_available():
            solution = self.runtime.replace_urls(force_text(self.solution))
        else:
            solution = ''
            
        is_due_date_passed = False
        show_correctness = self.show_correctness
        if show_correctness == 'past_due':
            if not self.due:
                show_correctness = "always"
            elif self.due < utcnow():
                is_due_date_passed = True

        return {
            "display_name": force_text(self.display_name),
            "question": self.runtime.replace_urls(force_text(self.question)),
            "submitted": submitted,
            "graded": graded,
            "max_score": self.max_score(),
            "upload_allowed": self.upload_allowed(submission_data=submission),
            "solution": solution,
            "base_asset_url": StaticContent.get_base_url_path_for_course_assets(self.location.course_key),
            "show_correctness": show_correctness,
            "is_due_date_passed": is_due_date_passed
        }

    def staff_grading_data(self):
        """
        Return student assignment information for display on the
        grading screen.
        """
        def get_student_data():
            # pylint: disable=no-member
            """
            Returns a dict of student assignment information along with
            student id and module id, this
            information will be used on grading screen
            """
            # Submissions doesn't have API for this, just use model directly.
            students = SubmissionsStudent.objects.filter(
                course_id=self.course_id,
                item_id=self.block_id)
            for student in students:
                submission = self.get_submission(student.student_id)
                if not submission:
                    continue
                user = user_by_anonymous_id(student.student_id)
                student_module = self.get_or_create_student_module(user)
                state = json.loads(student_module.state)
                score = self.get_score(student.student_id)
                approved = score is not None
                if score is None:
                    score = state.get('staff_score')
                    needs_approval = score is not None
                else:
                    needs_approval = False
                instructor = self.is_instructor()
                yield {
                    'module_id': student_module.id,
                    'student_id': student.student_id,
                    'submission_id': submission['uuid'],
                    'username': student_module.student.username,
                    'fullname': student_module.student.profile.name,
                    'score': score,
                    'approved': approved,
                    'needs_approval': instructor and needs_approval,
                    'may_grade': instructor or not approved,
                    'comment': force_text(state.get("comment", '')),
                    'finalized': is_finalized_submission(submission_data=submission)
                }

        return {
            'assignments': list(get_student_data()),
            'max_score': self.max_score(),
            'display_name': force_text(self.display_name)
        }

    def get_sorted_submissions(self):
        """returns student recent assignments sorted on date"""
        assignments = []
        submissions = submissions_api.get_all_submissions(
            self.course_id,
            self.block_id,
            ITEM_TYPE
        )

        for submission in submissions:
            if is_finalized_submission(submission_data=submission):
                assignments.append({
                    'submission_id': submission['uuid'],
                    'student_answer': submission['answer']["student_answer"],
                    'timestamp': submission['submitted_at'] or submission['created_at']
                })

        assignments.sort(
            key=lambda assignment: assignment['timestamp'], reverse=True
        )
        return assignments

    def validate_score_message(self, course_id, username):  # lint-amnesty, pylint: disable=missing-docstring
        log.error(
            "enter_grade: invalid grade submitted for course:%s module:%s student:%s",
            course_id,
            self.location,
            username
        )
        return {
            "error": "Please enter valid grade"
        }

    def is_course_staff(self):
        # pylint: disable=no-member
        """
         Check if user is course staff.
        """
        return getattr(self.xmodule_runtime, 'user_is_staff', False)

    def is_instructor(self):
        # pylint: disable=no-member
        """
        Check if user role is instructor.
        """
        return self.xmodule_runtime.get_user_role() == 'instructor'

    def show_staff_grading_interface(self):
        """
        Return if current user is staff and not in studio.
        """
        in_studio_preview = self.scope_ids.user_id is None
        return self.is_course_staff() and not in_studio_preview

    def past_due(self):
        """
        Return whether due date has passed.
        """
        due = get_extended_due_date(self)
        try:
            graceperiod = self.graceperiod
        except AttributeError:
            # graceperiod and due are defined in InheritanceMixin
            # It's used automatically in edX but the unit tests will need to mock it out
            graceperiod = None

        if graceperiod is not None and due:
            close_date = due + graceperiod
        else:
            close_date = due

        if close_date is not None:
            return utcnow() > close_date
        return False

    def upload_allowed(self, submission_data=None):
        """
        Return whether student is allowed to upload an assignment.
        """
        submission_data = submission_data if submission_data is not None else self.get_submission()
        return (
            not self.past_due() and
            self.score is None and
            not is_finalized_submission(submission_data)
        )

    def get_real_user(self):
        """returns session user"""
        return self.runtime.get_real_user(self.xmodule_runtime.anonymous_student_id)

    def correctness_available(self):
        """
        For SGA is_correct just means the user submitted the problem, which we always know one way or the other
        """
        return True

    def is_past_due(self):
        """
        Is it now past this problem's due date?
        """
        return self.past_due()

    def is_correct(self):
        """
        For SGA we show the answer as soon as we know the user has given us their submission
        """
        return self.has_attempted()

    def has_attempted(self):
        """
        True if the student has already attempted this problem
        """
        submission = self.get_submission()
        if not submission:
            return False
        return submission['answer']['finalized']

    def can_attempt(self):
        """
        True if the student can attempt the problem
        """
        return not self.has_attempted()

    def runtime_user_is_staff(self):
        """
        Is the logged in user a staff user?
        """
        return self.is_course_staff()


def _resource(path):  # pragma: NO COVER
    """
    Handy helper for getting resources from our kit.
    """
    data = pkg_resources.resource_string(__name__, path)
    return data.decode("utf8")


def load_resource(resource_path):  # pragma: NO COVER
    """
    Gets the content of a resource
    """
    resource_content = pkg_resources.resource_string(__name__, resource_path)
    return unicode(resource_content)


def render_template(template_path, context=None):  # pragma: NO COVER
    """
    Evaluate a template by resource path, applying the provided context.
    """
    if context is None:
        context = {}

    template_str = load_resource(template_path)
    template = Template(template_str)
    return template.render(Context(context))


def require(assertion):
    """
    Raises PermissionDenied if assertion is not true.
    """
    if not assertion:
        raise PermissionDenied
