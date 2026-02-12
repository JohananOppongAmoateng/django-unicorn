import logging

from django_unicorn.call_method_parser import parse_call_method_name
from django_unicorn.errors import UnicornViewError
from django_unicorn.serializer import JSONDecodeError, loads
from django_unicorn.utils import generate_checksum
from django_unicorn.views.action import Action, CallMethod, Refresh, Reset, SyncInput, Toggle

logger = logging.getLogger(__name__)


def parse_multipart_data(request):
    """
    Parse multipart/form-data request into a dictionary structure.
    
    Handles nested fields like 'data.field_name' and reconstructs the original structure.
    """
    data = {}
    files = {}
    
    # Parse POST data
    for key, value in request.POST.items():
        if key.startswith("data."):
            # Extract the field name after 'data.'
            field_path = key[5:]  # Remove 'data.' prefix
            
            # Handle nested paths (e.g., 'dict.key' -> data['dict']['key'])
            parts = field_path.split(".")
            current = data
            for i, part in enumerate(parts[:-1]):
                # Handle array notation
                if "[" in part and "]" in part:
                    base_key = part[:part.index("[")]
                    index = int(part[part.index("[") + 1:part.index("]")])
                    if base_key not in current:
                        current[base_key] = []
                    while len(current[base_key]) <= index:
                        current[base_key].append({})
                    current = current[base_key][index]
                else:
                    if part not in current:
                        current[part] = {}
                    current = current[part]
            
            # Set the final value
            final_key = parts[-1]
            if "[" in final_key and "]" in final_key:
                base_key = final_key[:final_key.index("[")]
                index = int(final_key[final_key.index("[") + 1:final_key.index("]")])
                if base_key not in current:
                    current[base_key] = []
                while len(current[base_key]) <= index:
                    current[base_key].append(None)
                current[base_key][index] = value
            else:
                current[final_key] = value
        elif key == "actionQueue":
            # Parse actionQueue JSON string
            data[key] = loads(value)
        else:
            # Store other fields directly
            data[key] = value
    
    # Parse FILES data
    for key, file_list in request.FILES.lists():
        if key.startswith("data."):
            field_path = key[5:]
            parts = field_path.split(".")
            current = data
            for part in parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]
            
            final_key = parts[-1]
            # Store single file or list of files
            if len(file_list) == 1:
                current[final_key] = file_list[0]
            else:
                current[final_key] = file_list
    
    return data


class ComponentRequest:
    """
    Parses, validates, and stores all of the data from the message request.
    """

    __slots__ = (
        "action_queue",
        "body",
        "data",
        "epoch",
        "hash",
        "id",
        "key",
        "name",
        "request",
    )

    def __init__(self, request, component_name):
        self.body = {}
        self.request = request

        # Check if this is a multipart/form-data request (contains files)
        content_type = request.META.get("CONTENT_TYPE", "")
        is_multipart = "multipart/form-data" in content_type

        try:
            if is_multipart:
                # Parse multipart data
                self.body = parse_multipart_data(request)
            else:
                # Parse JSON data
                self.body = loads(request.body)

            if not self.body:
                raise AssertionError("Invalid body")
        except JSONDecodeError as e:
            raise UnicornViewError("Body could not be parsed") from e

        self.name = component_name
        if not self.name:
            raise AssertionError("Missing component name")

        self.data = self.body.get("data")
        if self.data is None:
            raise AssertionError("Missing data")

        self.id = self.body.get("id")
        if not self.id:
            raise AssertionError("Missing component id")

        self.epoch = self.body.get("epoch", "")
        if not self.epoch:
            raise AssertionError("Missing epoch")

        self.key = self.body.get("key", "")
        self.hash = self.body.get("hash", "")

        self.validate_checksum()

        self.action_queue = []

        for action_data in self.body.get("actionQueue", []):
            action_type = action_data.get("type")
            payload = action_data.get("payload", {})

            if action_type == "syncInput":
                self.action_queue.append(SyncInput(action_data))
            elif action_type == "callMethod":
                name = payload.get("name", "")
                method_name, _, _ = parse_call_method_name(name)

                if method_name == "$refresh":
                    self.action_queue.append(Refresh(action_data))
                elif method_name == "$reset":
                    self.action_queue.append(Reset(action_data))
                elif method_name == "$toggle":
                    self.action_queue.append(Toggle(action_data))
                else:
                    self.action_queue.append(CallMethod(action_data))
            else:
                self.action_queue.append(Action(action_data))

    def __repr__(self):
        return (
            f"ComponentRequest(name='{self.name}' id='{self.id}' key='{self.key}'"
            f" epoch={self.epoch} data={self.data} action_queue={self.action_queue} hash={self.hash})"
        )

    def validate_checksum(self):
        """
        Validates that the checksum in the request matches the data.

        Returns:
            Raises `AssertionError` if the checksums don't match.
        """
        checksum = self.body.get("checksum")

        if not checksum:
            raise AssertionError("Missing checksum")

        generated_checksum = generate_checksum(self.data)

        if checksum != generated_checksum:
            raise AssertionError("Checksum does not match")
