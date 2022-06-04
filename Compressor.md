# Compressor

Compressor support includes a logging application and an optional sensor
package.

## Sensors

At HSAC the sensors are interfaced through a [Raspberry Pi](https://www.raspberrypi.org/) that reads [DS18B20](https://datasheets.maximintegrated.com/en/ds/DS18B20.pdf) temperature, [DHT11](https://www.makerguides.com/wp-content/uploads/2019/02/DHT11-Datasheet.pdf) humidity and temperature, and [PC817]()https://octopart.com/datasheet/pc817b-sharp-9239011) sensors. The Raspberry Pi runs a service that polls the sensors, and makes the results available via AJAX requests. The URL to make these requests is called the **Sensors root URL** and is specified in the configuration dialog of the main package. Sensors are
polled every few seconds. An audible alarm can be triggered if the internal
temperature sensor exceeds a given limit.

## Filter Life Prediction

Compressor manufacturers usually publish guidelines for the expected
lifetime of the filters in their compressors. These normally include a
<b>Predicted Filter Lifetime</b> *Lp* for the filter when the compressor is
run at a typical temperature (e.g. 20&deg;C). Compressor filter
performance degrades significantly at higher temperatures and
generally improves slightly at lower temperatures, so manufacturers
usually publish a curve indicating expected filter lifetime at
different temperatures. This is normally an exponential curve that we
have found in the case of our Coltri MCH/16 can be modelled using a symmetric
sigmoidal curve
```math
F=(D + (A - D))/(1+(T/C)^B)
```
where *T* is the
temperature, *F* is a lifetime degradation factor, and *A*, *B*, *C*
and *D* are constant **Coefficients**.

We can apply this degradation factor *F*
to the predicted lifetime *Lp* to obtain a predicted lifetime at that
temperature in hours
<div class="equation">
Lpt = F * Lp
</div>

For a runtime of*dT* hours, we can
then obtain an fraction of filter lifetime used so far:
<div class="equation">
Flu = <div class="fraction"><span class="fup">dT</span><span class="fdn">Lpt</span></div></div>

We then subtract that from *Lp* to get a new remaining
filter life prediction. 

The default filter lifetime constants for the static compressor
prediction re derived from data provided by Coltri for an MCH 16/ET,
and for the portable compressor by Bauer for a PE100, though you can
provide your own coefficients to match your compressor/filters in the
configuration dialog (http://www.mycurvefit.com provides a convenient way
to fit a symmetric sigmoidal curve to a set of data points)

## Operational Limits

The application automatically evaluates values of temperature and
humidity to determine whether it is safe to operate the compressor.

The lifetime of filters is mostly determined by the amount of water
that has to be removed from the air. In an effort to maximise filter
life, the app will advise when temperature and humidity are within limits.

Going back to basics, the saturation partial pressure of water vapour
is proportional to temperature:

<div class="equation">
Sp = 610.78 * e<sup>17.2694 * (<div class="fraction">
<span class="fup">T</span><span class="fdn">T + 238.3</span></div>)</div>
</div>

where *T* is the air temperature in &deg;C, and *Sp* is in Pascals. This
can be converted to a water vapour capacity in gm<sup>-3</sup>

<div class="equation">
Cw = 2.166 * <div class="fraction"><span class="fup">Sp</span><span class="fdn">T + 273.16</span></div>
</div>

Using these equations, air at 20&deg;C will have a water vapour capacity
of around 17gm<sup>-3</sup> at 1 bar. Since:

<div class="equation">
Relative Humidity (RH) = <div class="fraction"><span class="fup">Water vapour content</span><span class="fdn">Water vapour capacity</span></div> * 100%
</div>

this is the water content at a RH of 100%. At 20&deg;C, 80% humidity, the air contains 13.6gm<sup>-3</sup>.
At 50% humidity, 8.5gm<sup>-3</sup>

Let's say it's 80%RH and 20&deg;C. You are pumping a 10L cylinder to
232 bar, that is 2320 litres (2.32m<sup>3</sup>) of air at 1 bar
which will contain 31.55g of water vapour. Since the dryness
requirement (for Nitrox) is 0.02gm<sup>-3</sup>
that means there can be no more than 0.046g of water in the filled
tank. So we have to remove 31.5g of water.

The reason the amount of water removed is important is that the
performance of the filtration system depends on it. Let's say you pump
at 300L per minute. That will fill a 12 from empty in roughly 9
minutes. So at 80% RH and 20&deg;C, the compressor will remove roughly 38g
(38ml) of water in that time. You have to purge that water (condensate)
from the system, otherwise it pools at the base of the filter and saturates the
media, but every time you purge you lose pressure, which increases the
fill time. We have to find a "sweet spot" where the fill time is minimised,
but the filter life is maximised. We do this by setting a threshold for the
amount of condensate that can be generated in a single purge cycle.

The threshold is a function of:
1. The **Maximum condensate** volume (in ml) which is acceptable between purges
2. The **Pumping rate** of the compressor (in litres per minute)
3. The **Purging frequency**, in minutes
4. The temperature and humidity (and atmospheric pressure, though the effect
of this is negligible)

The parameters controlling this calculation can be set up in the
configuration dialog. Temperature and humidity are either read from sensors
or manually entered. Experience has shown that our compressor can tolerate a
build up of up to 35ml of condensate before a purge becomes necessary. Purging
every 7 minutes means we can fill at up to 90% humidity, below 20&deg;C.

Note that we have found the DHT11 humidity sensor to be particularly unreliable, so we use manually entered values most of the time. Some day we should really replace them with something better (e.g. an AHT20).
