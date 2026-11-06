"""Static kiosk pilot. Child applications require the coordinated composition contract."""
from __future__ import annotations
import json
import os
from typing import Annotated, Literal, Union
from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr, model_validator

Key = Annotated[StrictStr, Field(pattern=r'^[a-zA-Z0-9_-]{1,64}$')]
Label = Annotated[StrictStr, Field(min_length=1, max_length=100)]
File = Annotated[StrictStr, Field(pattern=r'^[A-Za-z0-9!._-]{1,256}$')]

class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)

class Section(Model):
    title: Annotated[StrictStr, Field(max_length=100)] = ''
    text: Annotated[StrictStr, Field(max_length=4000)] = ''
    imageFileId: File | None = None

class PageButton(Model):
    id: Key
    type: Literal['page']
    label: Label
    pageId: Key

class MediaButton(Model):
    id: Key
    type: Literal['media']
    label: Label
    fileId: File

Button = Annotated[Union[PageButton, MediaButton], Field(discriminator='type')]

class Page(Model):
    id: Key
    title: Label
    sections: Annotated[list[Section], Field(max_length=40)] = []
    buttons: Annotated[list[Button], Field(max_length=100)] = []

class Payload(Model):
    title: Label
    startPage: Key = 'home'
    menuPosition: Literal['left','right','top','bottom'] = 'left'
    idleSeconds: Annotated[StrictInt, Field(ge=0, le=3600)] = 60
    pages: Annotated[list[Page], Field(min_length=1, max_length=100)]

    @model_validator(mode='after')
    def graph(self):
        ids=[p.id for p in self.pages]
        if len(set(ids))!=len(ids) or 'home' not in ids or self.startPage not in ids:
            raise ValueError('Unique pages, home and an existing start page are required')
        count=0
        for page in self.pages:
            buttons=[b.id for b in page.buttons]
            count+=len(buttons)
            if len(set(buttons))!=len(buttons):raise ValueError('Button IDs must be unique within each page')
            for button in page.buttons:
                if button.type=='page' and button.pageId not in ids:raise ValueError('Unknown page target')
        if count>1000:raise ValueError('Too many buttons')
        if len(json.dumps(self.model_dump(),ensure_ascii=False).encode())>262144:raise ValueError('Kiosk payload exceeds 256 KiB')
        return self

def validate(payload,presentation):
    # Presentation/schema validation and entitlement enforcement belong to the shared registry.
    return Payload.model_validate(payload).model_dump()

def prepare(actor,payload,connection):
    from eduvize_admin.output_media import prepare_asset
    from eduvize_admin.output_registry import fail
    value=validate(payload,{})
    entries={}
    def pin(file_id,image=False):
        if file_id in ('.','..'):fail(422,'INVALID_MEDIA','Neplatný soubor.')
        entry=prepare_asset(connection,actor.school,file_id)
        mime=entry['metadata']['mime']
        if mime not in ('image/jpeg','image/png','image/webp') and (image or mime!='application/pdf'):
            fail(422,'UNSUPPORTED_KIOSK_MEDIA','Kiosek podporuje obrázky a PDF; sekce pouze obrázky.')
        ident=entry['metadata']['id'];entries[ident]=entry
        return ident
    for page in value['pages']:
        for section in page['sections']:
            file_id=section.pop('imageFileId')
            section['imageMediaId']=pin(file_id,True) if file_id else None
        for button in page['buttons']:
            if button['type']=='media':button['mediaId']=pin(button.pop('fileId'))
    return value,list(entries.values())

def get_output_adapters():
    from eduvize_admin.output_registry import Adapter
    from eduvize_admin.output_media import read_asset
    import psycopg
    def connect():return psycopg.connect(os.environ['DATABASE_URL'],connect_timeout=10)
    return {'kiosk':Adapter(validate,'/eduvize-kiosek/published.html',prepare,
                            lambda entry,request:read_asset(connect,entry,request))}
