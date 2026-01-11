<br />

The Gemini API enables Retrieval Augmented Generation ("RAG") through the File Search tool. File Search imports, chunks, and indexes your data to enable fast retrieval of relevant information based on a provided prompt. This information is then used as context to the model, allowing the model to provide more accurate and relevant answers.

To make File Search simple and affordable for developers, we're making file storage and embedding generation at query time free of charge. You only pay for creating embeddings when you first index your files (at the applicable embedding model cost) and the normal Gemini model input / output tokens cost. This new billing paradigm makes the File Search Tool both easier and more cost-effective to build and scale with.

## Directly upload to File Search store

This examples shows how to directly upload a file to the[file search store](https://ai.google.dev/api/file-search/file-search-stores#method:-media.uploadtofilesearchstore):  

### Python

    from google import genai
    from google.genai import types
    import time

    client = genai.Client()

    # File name will be visible in citations
    file_search_store = client.file_search_stores.create(config={'display_name': 'your-fileSearchStore-name'})

    operation = client.file_search_stores.upload_to_file_search_store(
      file='sample.txt',
      file_search_store_name=file_search_store.name,
      config={
          'display_name' : 'display-file-name',
      }
    )

    while not operation.done:
        time.sleep(5)
        operation = client.operations.get(operation)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="""Can you tell me about [insert question]""",
        config=types.GenerateContentConfig(
            tools=[
                types.Tool(
                    file_search=types.FileSearch(
                        file_search_store_names=[file_search_store.name]
                    )
                )
            ]
        )
    )

    print(response.text)

### JavaScript

    const { GoogleGenAI } = require('@google/genai');

    const ai = new GoogleGenAI({});

    async function run() {
      // File name will be visible in citations
      const fileSearchStore = await ai.fileSearchStores.create({
        config: { displayName: 'your-fileSearchStore-name' }
      });

      let operation = await ai.fileSearchStores.uploadToFileSearchStore({
        file: 'file.txt',
        fileSearchStoreName: fileSearchStore.name,
        config: {
          displayName: 'file-name',
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.get({ operation });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Can you tell me about [insert question]",
        config: {
          tools: [
            {
              fileSearch: {
                fileSearchStoreNames: [fileSearchStore.name]
              }
            }
          ]
        }
      });

      console.log(response.text);
    }

    run();

Check the API reference for[`uploadToFileSearchStore`](https://ai.google.dev/api/file-search/file-search-stores#method:-media.uploadtofilesearchstore)for more information.

## Importing files

Alternatively, you can upload an existing file and[import it to your file search store](https://ai.google.dev/api/file-search/file-search-stores#method:-filesearchstores.importfile):  

### Python

    from google import genai
    from google.genai import types
    import time

    client = genai.Client()

    # File name will be visible in citations
    sample_file = client.files.upload(file='sample.txt', config={'name': 'display_file_name'})

    file_search_store = client.file_search_stores.create(config={'display_name': 'your-fileSearchStore-name'})

    operation = client.file_search_stores.import_file(
        file_search_store_name=file_search_store.name,
        file_name=sample_file.name
    )

    while not operation.done:
        time.sleep(5)
        operation = client.operations.get(operation)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="""Can you tell me about [insert question]""",
        config=types.GenerateContentConfig(
            tools=[
                types.Tool(
                    file_search=types.FileSearch(
                        file_search_store_names=[file_search_store.name]
                    )
                )
            ]
        )
    )

    print(response.text)

### JavaScript

    const { GoogleGenAI } = require('@google/genai');

    const ai = new GoogleGenAI({});

    async function run() {
      // File name will be visible in citations
      const sampleFile = await ai.files.upload({
        file: 'sample.txt',
        config: { name: 'file-name' }
      });

      const fileSearchStore = await ai.fileSearchStores.create({
        config: { displayName: 'your-fileSearchStore-name' }
      });

      let operation = await ai.fileSearchStores.importFile({
        fileSearchStoreName: fileSearchStore.name,
        fileName: sampleFile.name
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.get({ operation: operation });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Can you tell me about [insert question]",
        config: {
          tools: [
            {
              fileSearch: {
                fileSearchStoreNames: [fileSearchStore.name]
              }
            }
          ]
        }
      });

      console.log(response.text);
    }

    run();

Check the API reference for[`importFile`](https://ai.google.dev/api/file-search/file-search-stores#method:-filesearchstores.importfile)for more information.

## Chunking configuration

When you import a file into a File Search store, it's automatically broken down into chunks, embedded, indexed, and uploaded to your File Search store. If you need more control over the chunking strategy, you can specify a[`chunking_config`](https://ai.google.dev/api/file-search/file-search-stores#request-body_5)setting to set a maximum number of tokens per chunk and maximum number of overlapping tokens.  

### Python

    operation = client.file_search_stores.upload_to_file_search_store(
        file_search_store_name=file_search_store.name,
        file_name=sample_file.name,
        config={
            'chunking_config': {
              'white_space_config': {
                'max_tokens_per_chunk': 200,
                'max_overlap_tokens': 20
              }
            }
        }
    )

### JavaScript

    let operation = await ai.fileSearchStores.uploadToFileSearchStore({
      file: 'file.txt',
      fileSearchStoreName: fileSearchStore.name,
      config: {
        displayName: 'file-name',
        chunkingConfig: {
          whiteSpaceConfig: {
            maxTokensPerChunk: 200,
            maxOverlapTokens: 20
          }
        }
      }
    });

To use your File Search store, pass it as a tool to the`generateContent`method, as shown in the[Upload](https://ai.google.dev/gemini-api/docs/file-search#upload)and[Import](https://ai.google.dev/gemini-api/docs/file-search#importing-files)examples.

## How it works

File Search uses a technique called semantic search to find information relevant to the user prompt. Unlike standard keyword-based search, semantic search understands the meaning and context of your query.

When you import a file, it's converted into numerical representations called[embeddings](https://ai.google.dev/gemini-api/docs/embeddings), which capture the semantic meaning of the text. These embeddings are stored in a specialized File Search database. When you make a query, it's also converted into an embedding. Then the system performs a File Search to find the most similar and relevant document chunks from the File Search store.

Here's a breakdown of the process for using the File Search`uploadToFileSearchStore`API:

1. **Create a File Search store**: A File Search store contains the processed data from your files. It's the persistent container for the embeddings that the semantic search will operate on.

2. **Upload a file and import into a File Search store** : Simultaneously upload a file and import the results into your File Search store. This creates a temporary`File`object, which is a reference to your raw document. That data is then chunked, converted into File Search embeddings, and indexed. The`File`object gets deleted after 48 hours, while the data imported into the File Search store will be stored indefinitely until you choose to delete it.

3. **Query with File Search** : Finally, you use the`FileSearch`tool in a`generateContent`call. In the tool configuration, you specify a`FileSearchRetrievalResource`, which points to the`FileSearchStore`you want to search. This tells the model to perform a semantic search on that specific File Search store to find relevant information to ground its response.

![The indexing and querying process of File Search](https://ai.google.dev/static/gemini-api/docs/images/File-search.png)The indexing and querying process of File Search

In this diagram, the dotted line from from*Documents* to*Embedding model* (using[`gemini-embedding-001`](https://ai.google.dev/gemini-api/docs/embeddings)) represents the`uploadToFileSearchStore`API (bypassing*File storage* ). Otherwise, using the[Files API](https://ai.google.dev/gemini-api/docs/files)to separately create and then import files moves the indexing process from*Documents* to*File storage* and then to*Embedding model*.

## File Search stores

A File Search store is a container for your document embeddings. While raw files uploaded through the File API are deleted after 48 hours, the data imported into a File Search store is stored indefinitely until you manually delete it. You can create multiple File Search stores to organize your documents. The`FileSearchStore`API lets you create, list, get, and delete to manage your file search stores. File Search store names are globally scoped.

Here are some examples of how to manage your File Search stores:  

### Python

    file_search_store = client.file_search_stores.create(config={'display_name': 'my-file_search-store-123'})

    for file_search_store in client.file_search_stores.list():
        print(file_search_store)

    my_file_search_store = client.file_search_stores.get(name='fileSearchStores/my-file_search-store-123')

    client.file_search_stores.delete(name='fileSearchStores/my-file_search-store-123', config={'force': True})

### JavaScript

    const fileSearchStore = await ai.fileSearchStores.create({
      config: { displayName: 'my-file_search-store-123' }
    });

    const fileSearchStores = await ai.fileSearchStores.list();
    for await (const store of fileSearchStores) {
      console.log(store);
    }

    const myFileSearchStore = await ai.fileSearchStores.get({
      name: 'fileSearchStores/my-file_search-store-123'
    });

    await ai.fileSearchStores.delete({
      name: 'fileSearchStores/my-file_search-store-123',
      config: { force: true }
    });

### REST

    curl -X POST "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${GEMINI_API_KEY}" \
        -H "Content-Type: application/json" 
        -d '{ "displayName": "My Store" }'

    curl "https://generativelanguage.googleapis.com/v1beta/fileSearchStores?key=${GEMINI_API_KEY}" \

    curl "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/my-file_search-store-123?key=${GEMINI_API_KEY}"

    curl -X DELETE "https://generativelanguage.googleapis.com/v1beta/fileSearchStores/my-file_search-store-123?key=${GEMINI_API_KEY}"

The[File Search Documents](https://ai.google.dev/api/file-search/documents)API reference for methods and fields related to managing documents in your file stores.

## File metadata

You can add custom metadata to your files to help filter them or provide additional context. Metadata is a set of key-value pairs.  

### Python

    op = client.file_search_stores.import_file(
        file_search_store_name=file_search_store.name,
        file_name=sample_file.name,
        custom_metadata=[
            {"key": "author", "string_value": "Robert Graves"},
            {"key": "year", "numeric_value": 1934}
        ]
    )

### JavaScript

    let operation = await ai.fileSearchStores.importFile({
      fileSearchStoreName: fileSearchStore.name,
      fileName: sampleFile.name,
      config: {
        customMetadata: [
          { key: "author", stringValue: "Robert Graves" },
          { key: "year", numericValue: 1934 }
        ]
      }
    });

This is useful when you have multiple documents in a File Search store and want to search only a subset of them.  

### Python

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Tell me about the book 'I, Claudius'",
        config=types.GenerateContentConfig(
            tools=[
                types.Tool(
                    file_search=types.FileSearch(
                        file_search_store_names=[file_search_store.name],
                        metadata_filter="author=Robert Graves",
                    )
                )
            ]
        )
    )

    print(response.text)

### JavaScript

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Tell me about the book 'I, Claudius'",
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [fileSearchStore.name],
              metadataFilter: 'author="Robert Graves"',
            }
          }
        ]
      }
    });

    console.log(response.text);

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}" \
        -H 'Content-Type: application/json' \
        -X POST \
        -d '{
                "contents": [{
                    "parts":[{"text": "Tell me about the book I, Claudius"}]          
                }],
                "tools": [{
                    "file_search": { 
                        "file_search_store_names":["'$STORE_NAME'"],
                        "metadata_filter": "author = \"Robert Graves\""
                    }
                }]
            }' 2> /dev/null > response.json

    cat response.json

Guidance on implementing list filter syntax for`metadata_filter`can be found at[google.aip.dev/160](https://google.aip.dev/160)

## Citations

When you use File Search, the model's response may include citations that specify which parts of your uploaded documents were used to generate the answer. This helps with fact-checking and verification.

You can access citation information through the`grounding_metadata`attribute of the response.  

### Python

    print(response.candidates[0].grounding_metadata)

### JavaScript

    console.log(JSON.stringify(response.candidates?.[0]?.groundingMetadata, null, 2));

## Structured output

Starting with Gemini 3 models, you can combine file search tool with[structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).  

### Python

    from pydantic import BaseModel, Field

    class Money(BaseModel):
        amount: str = Field(description="The numerical part of the amount.")
        currency: str = Field(description="The currency of amount.")

    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents="What is the minimum hourly wage in Tokyo right now?",
        config=types.GenerateContentConfig(
                    tools=[
                        types.Tool(
                            file_search=types.FileSearch(
                                file_search_store_names=[file_search_store.name]
                            )
                        )
                    ],
                    responseMimeType="application/json",
                    responseJsonSchema= Money.model_json_schema()
          )
    )
    result = Money.model_validate_json(response.text)
    print(result)

### JavaScript

    import { z } from "zod";
    import { zodToJsonSchema } from "zod-to-json-schema";

    const moneySchema = z.object({
      amount: z.string().describe("The numerical part of the amount."),
      currency: z.string().describe("The currency of amount."),
    });

    async function run() {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "What is the minimum hourly wage in Tokyo right now?",
        config: {
          tools: [
            {
              fileSearch: {
                fileSearchStoreNames: [file_search_store.name],
              },
            },
          ],
          responseMimeType: "application/json",
          responseJsonSchema: zodToJsonSchema(moneySchema),
        },
      });

      const result = moneySchema.parse(JSON.parse(response.text));
      console.log(result);
    }

    run();

### REST

    curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent" \
      -H "x-goog-api-key: $GEMINI_API_KEY" \
      -H 'Content-Type: application/json' \
      -X POST \
      -d "{
        \"contents\": [{
          \"parts\": [{\"text\": \"What is the minimum hourly wage in Tokyo right now?\"}]
        }],
        \"tools\": [
          {
            \"fileSearch\": {
              \"fileSearchStoreNames\": [\"$STORE_NAME\"]
            }
          }
        ],
        \"generationConfig\": {
            \"responseMimeType\": \"application/json\",
            \"responseJsonSchema\": {
                \"type\": \"object\",
                \"properties\": {
                    \"amount\": {\"type\": \"string\", \"description\": \"The numerical part of the amount.\"},
                    \"currency\": {\"type\": \"string\", \"description\": \"The currency of amount.\"}
                },
                \"required\": [\"amount\", \"currency\"]
            }
        }
      }"

## Supported models

The following models support File Search:

- [`gemini-3-pro-preview`](https://ai.google.dev/gemini-api/docs/models#gemini-3-pro)
- [`gemini-3-flash-preview`](https://ai.google.dev/gemini-api/docs/models#gemini-3-flash)
- [`gemini-2.5-pro`](https://ai.google.dev/gemini-api/docs/models#gemini-2.5-pro)
- [`gemini-2.5-flash`](https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash)and its preview versions
- [`gemini-2.5-flash-lite`](https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash-lite)and its preview versions

## Supported file types

File Search supports a wide range of file formats, listed in the following sections.

### Application file types

- `application/dart`
- `application/ecmascript`
- `application/json`
- `application/ms-java`
- `application/msword`
- `application/pdf`
- `application/sql`
- `application/typescript`
- `application/vnd.curl`
- `application/vnd.dart`
- `application/vnd.ibm.secure-container`
- `application/vnd.jupyter`
- `application/vnd.ms-excel`
- `application/vnd.oasis.opendocument.text`
- `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.template`
- `application/x-csh`
- `application/x-hwp`
- `application/x-hwp-v5`
- `application/x-latex`
- `application/x-php`
- `application/x-powershell`
- `application/x-sh`
- `application/x-shellscript`
- `application/x-tex`
- `application/x-zsh`
- `application/xml`
- `application/zip`

### Text file types

- `text/1d-interleaved-parityfec`
- `text/RED`
- `text/SGML`
- `text/cache-manifest`
- `text/calendar`
- `text/cql`
- `text/cql-extension`
- `text/cql-identifier`
- `text/css`
- `text/csv`
- `text/csv-schema`
- `text/dns`
- `text/encaprtp`
- `text/enriched`
- `text/example`
- `text/fhirpath`
- `text/flexfec`
- `text/fwdred`
- `text/gff3`
- `text/grammar-ref-list`
- `text/hl7v2`
- `text/html`
- `text/javascript`
- `text/jcr-cnd`
- `text/jsx`
- `text/markdown`
- `text/mizar`
- `text/n3`
- `text/parameters`
- `text/parityfec`
- `text/php`
- `text/plain`
- `text/provenance-notation`
- `text/prs.fallenstein.rst`
- `text/prs.lines.tag`
- `text/prs.prop.logic`
- `text/raptorfec`
- `text/rfc822-headers`
- `text/rtf`
- `text/rtp-enc-aescm128`
- `text/rtploopback`
- `text/rtx`
- `text/sgml`
- `text/shaclc`
- `text/shex`
- `text/spdx`
- `text/strings`
- `text/t140`
- `text/tab-separated-values`
- `text/texmacs`
- `text/troff`
- `text/tsv`
- `text/tsx`
- `text/turtle`
- `text/ulpfec`
- `text/uri-list`
- `text/vcard`
- `text/vnd.DMClientScript`
- `text/vnd.IPTC.NITF`
- `text/vnd.IPTC.NewsML`
- `text/vnd.a`
- `text/vnd.abc`
- `text/vnd.ascii-art`
- `text/vnd.curl`
- `text/vnd.debian.copyright`
- `text/vnd.dvb.subtitle`
- `text/vnd.esmertec.theme-descriptor`
- `text/vnd.exchangeable`
- `text/vnd.familysearch.gedcom`
- `text/vnd.ficlab.flt`
- `text/vnd.fly`
- `text/vnd.fmi.flexstor`
- `text/vnd.gml`
- `text/vnd.graphviz`
- `text/vnd.hans`
- `text/vnd.hgl`
- `text/vnd.in3d.3dml`
- `text/vnd.in3d.spot`
- `text/vnd.latex-z`
- `text/vnd.motorola.reflex`
- `text/vnd.ms-mediapackage`
- `text/vnd.net2phone.commcenter.command`
- `text/vnd.radisys.msml-basic-layout`
- `text/vnd.senx.warpscript`
- `text/vnd.sosi`
- `text/vnd.sun.j2me.app-descriptor`
- `text/vnd.trolltech.linguist`
- `text/vnd.wap.si`
- `text/vnd.wap.sl`
- `text/vnd.wap.wml`
- `text/vnd.wap.wmlscript`
- `text/vtt`
- `text/wgsl`
- `text/x-asm`
- `text/x-bibtex`
- `text/x-boo`
- `text/x-c`
- `text/x-c++hdr`
- `text/x-c++src`
- `text/x-cassandra`
- `text/x-chdr`
- `text/x-coffeescript`
- `text/x-component`
- `text/x-csh`
- `text/x-csharp`
- `text/x-csrc`
- `text/x-cuda`
- `text/x-d`
- `text/x-diff`
- `text/x-dsrc`
- `text/x-emacs-lisp`
- `text/x-erlang`
- `text/x-gff3`
- `text/x-go`
- `text/x-haskell`
- `text/x-java`
- `text/x-java-properties`
- `text/x-java-source`
- `text/x-kotlin`
- `text/x-lilypond`
- `text/x-lisp`
- `text/x-literate-haskell`
- `text/x-lua`
- `text/x-moc`
- `text/x-objcsrc`
- `text/x-pascal`
- `text/x-pcs-gcd`
- `text/x-perl`
- `text/x-perl-script`
- `text/x-python`
- `text/x-python-script`
- `text/x-r-markdown`
- `text/x-rsrc`
- `text/x-rst`
- `text/x-ruby-script`
- `text/x-rust`
- `text/x-sass`
- `text/x-scala`
- `text/x-scheme`
- `text/x-script.python`
- `text/x-scss`
- `text/x-setext`
- `text/x-sfv`
- `text/x-sh`
- `text/x-siesta`
- `text/x-sos`
- `text/x-sql`
- `text/x-swift`
- `text/x-tcl`
- `text/x-tex`
- `text/x-vbasic`
- `text/x-vcalendar`
- `text/xml`
- `text/xml-dtd`
- `text/xml-external-parsed-entity`
- `text/yaml`

## Limitations

- **Tool incompatibility:** [File Search](https://ai.google.dev/gemini-api/docs/file-search)cannot be combined with other tools like[Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search),[URL Context](https://ai.google.dev/gemini-api/docs/url-context)etc.

## Rate limits

The File Search API has the following limits to enforce service stability:

- **Maximum file size / per document limit**: 100 MB
- **Total size of project File Search stores** (based on user tier):
  - **Free**: 1 GB
  - **Tier 1**: 10 GB
  - **Tier 2**: 100 GB
  - **Tier 3**: 1 TB
- **Recommendation**: Limit the size of each File Search store to under 20 GB to ensure optimal retrieval latencies.

| **Note:** The limit on File Search store size is computed on the backend, based on the size of your input plus the embeddings generated and stored with it. This is typically approximately 3 times the size of your input data.

## Pricing

- Developers are charged for embeddings at indexing time based on existing[embeddings pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-embedding)($0.15 per 1M tokens).
- Storage is free of charge.
- Query time embeddings are free of charge.
- Retrieved document tokens are charged as regular[context tokens](https://ai.google.dev/gemini-api/docs/tokens).

## What's next

- Visit the API reference for[File Search Stores](https://ai.google.dev/api/file-search/file-search-stores)and File Search[Documents](https://ai.google.dev/api/file-search/documents).