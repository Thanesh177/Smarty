"""A connected test lesson, rather than repeated word-count filler."""

LESSON = """Imagine a language model halfway through writing an answer. It has already
read the question and produced several words, but the next word still depends on
what came before it. Why should it perform the same work again? A key-value
cache preserves some earlier calculations so that the next prediction can use
them. The interesting distinction is between remembering an intermediate result
and remembering the final answer. Following that distinction tells us both why
this technique saves work and why it still needs additional memory.

## Why earlier tokens need not start over

A token is a chunk of text represented by a number, not necessarily a whole
word. During attention, the model transforms information about each token into
a query, a key, and a value. The query represents what the current position is
looking for; keys provide things it can compare that query against; values hold
information that contributes to the resulting representation. These are learned
numerical vectors, meaning ordered collections of numbers, not dictionary entries.

In a causal decoder, earlier positions cannot attend to future positions. That
restriction means their keys and values do not need to change simply because
another token has been added. Without caching, a straightforward implementation
could recalculate them as part of processing the growing sequence. With caching,
the model preserves those particular results while still calculating new attention
for the latest position. Reusing them does not mean skipping all future work.

## Following one token through the cache

Consider a hypothetical prompt containing three tokens. The initial pass computes
their keys and values at each decoder layer, which is one stage of the model's
processing. Those results become the starting cache. When a new token arrives,
its query is compared with the available keys. The comparison produces scores,
which are converted into attention weights. A weight controls how much a value
contributes to the combined representation; it is not a claim that the model has
understood that earlier word in a human sense.

The new token also produces its own key and value, extending the cache. This
happens layer by layer, and the resulting representation contributes to predicting
another token. Notice the remaining work: the query must still be compared with
earlier keys, and values must still be combined. The cache removes redundant
calculations for previous positions, not the need to consult the past. Our
three-token example becomes a four-position cache rather than a stored answer.

## The memory bill behind a faster answer

Now change one condition in the example: use a longer prompt rather than a
three-token prompt. There are more earlier keys and values to preserve, and more
positions for the new query to compare against. Memory consumption therefore
grows with the sequence length. The precise cost also depends on the number of
layers, how the architecture organizes attention, and the numerical precision used
to store each value. Precision describes how much detail a numerical representation
retains; using fewer bits can save space but may introduce approximation.

This is a trade-off, not a universal guarantee that every request becomes fast.
An application serving many simultaneous conversations must hold different active
contexts, so its memory budget matters alongside computation. A cache for one
conversation is not automatically valid for another conversation with a different
prefix or model configuration. A shared word appearing in both is not enough;
the earlier computation depended on the context surrounding that word. Reuse has
to respect those dependencies to preserve the intended calculation.

## From saved keys to the next prediction

Our opening puzzle now has a narrower answer: the model can avoid recalculating
earlier keys and values because causal attention prevents later tokens from
changing those earlier representations during this decoding process. It still has
to process the new position, read the appropriate cached information, and calculate
the next prediction. That explains why the method can save redundant work while
retaining a growing memory cost. It does not provide permanent human-like memory,
and it does not make the model's factual claims reliable by itself.

One useful next concept is prefix caching: reusing an initial computation when
multiple requests truly share a compatible starting context. It extends our
dependency question from successive tokens in one request to separate requests.
Which parts of the earlier calculation must remain identical before sharing them
is valid? That question follows directly from the distinction between caching a
context-dependent representation and treating text as a context-free dictionary.
""".strip()
