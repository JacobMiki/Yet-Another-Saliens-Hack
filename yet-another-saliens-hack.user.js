//==UserScript==
// @name          	Yet Another Saliens Hack
// @description     Hack for Saliens Steam Sale 2018
// @author          JacobMiki
// @namespace       http://github.com/JacobMiki
//
// @updateURL		    https://github.com/JacobMiki/Yet-Another-Saliens-Hack/raw/master/yet-another-saliens-hack.user.js
// @downloadURL		  https://github.com/JacobMiki/Yet-Another-Saliens-Hack/raw/master/yet-another-saliens-hack.user.js
// @version         20180623_1200
// @supportURL      https://github.com/JacobMiki/Yet-Another-Saliens-Hack/issues
//
// @license         MIT License
//
// @include         https://steamcommunity.com/saliengame
// @include         https://steamcommunity.com/saliengame/
// @include         https://steamcommunity.com/saliengame/play
// @include         https://steamcommunity.com/saliengame/play/
//
// @run-at          document-start|document-end
//
// @grant           unsafeWindow
//
// @unwrap
//==/UserScript==

let ajaxPending = false;

(() => {
  GameLoadError = function () {
    setTimeout(function () {
      if (typeof unsafeWindow !== "undefined")
        unsafeWindow.location.reload();
      else
        window.location.reload();
    }, 750);
  };

  $J.ajax_orig = $J.ajax;
  $J.ajax = function (opts) {
    ajaxPending = true;
    return $J.ajax_orig(opts)
      .success((r) => {
        ajaxPending = false;
      });
  }

  CEnemy.prototype.Walk = function () {
    this.Die(true);
  }

  CGame.prototype.Start_orig = CGame.prototype.Start;
  CGame.prototype.Start = function () {
    setTimeout(() => this.Start(), 1000);
  };

  CBootState.prototype.OnLoadComplete_orig = CBootState.prototype.OnLoadComplete;
  CBootState.prototype.OnLoadComplete = function (loader, resources) {
    this.OnLoadComplete_orig(loader, resources);
    const startGame = () => {
      if (gServer.m_WebAPI) {
        gGame.m_State.button.click();
      } else {
        setTimeout(startGame, 100);
      }
    };
    startGame();
  };

  CPlanetSelectionState.prototype.OnLoadComplete_orig = CPlanetSelectionState.prototype.OnLoadComplete;
  CPlanetSelectionState.prototype.OnLoadComplete = function (loader, resources) {
    this.OnLoadComplete_orig(loader, resources);
    waitForResponse(() => {
      const uncapturedPlanets = gGame.m_State.m_rgPlanets
        .filter(function (p) {
          return p.state && !p.state.captured
        })
        .sort(function (p1, p2) {
          return p2.difficulty - p1.difficulty
        });

      gServer.JoinPlanet(
        uncapturedPlanets[0].id,
        (response) => {
          gGame.ChangeState(new CBattleSelectionState(uncapturedPlanets[0].id));
        },
        (response) => {
          ShowAlertDialog('Join Planet Error', 'Failed to join planet.  Please reload your game or try again shortly.');
        }
      );
    });
  };

  let loadedZone = null;
  CBattleSelectionState.prototype.OnLoadComplete_orig = CBattleSelectionState.prototype.OnLoadComplete;
  CBattleSelectionState.prototype.OnLoadComplete = function (loader, resources) {
    this.OnLoadComplete_orig(loader, resources);

    var uncapturedZones = gGame.m_State.m_PlanetData.zones
      .filter(function (z) {
        return !z.captured
      })
      .sort(function (z1, z2) {
        return getZonePriority(z2) - getZonePriority(z1)
      });

    if (!uncapturedZones.length) {
      gServer.LeaveGameInstance(
        this.m_unPlanetID,
        () => {
          gGame.ChangeState(new CPlanetSelectionState());
        }
      );
    } else {
      loadedZone = uncapturedZones[0];
      gServer.JoinZone(
        uncapturedZones[0].zone_position,
        (results) => {
          gGame.ChangeState(new CBattleState(this.m_PlanetData, uncapturedZones[0].zone_position));
        },
        GameLoadError
      );
    }
  };

  let g_ScoreIncrements = 0;
  CBattleState.prototype.OnLoadComplete_orig = CBattleState.prototype.OnLoadComplete;
  CBattleState.prototype.OnLoadComplete = function (loader, resources) {
    this.OnLoadComplete_orig(loader, resources);
    g_ScoreIncrements = this.m_ScoreIncrements;
    const m_SalienInfoBox = new CSalienInfoBox();
    m_SalienInfoBox.x = gApp.screen.width - m_SalienInfoBox.width - 12;
    m_SalienInfoBox.y = k_ScreenHeight - 72;
    gApp.stage.addChild(m_SalienInfoBox);

    loadedZone.clanavatar = 'clanavatar_' + loadedZone.leader.accountid;
    loadedZone.clanurl = loadedZone.leader.url;
    loadedZone.clans = loadedZone.top_clans;

    const m_ZoneInfoBox = new CZoneInfoBox();
    m_ZoneInfoBox.SetTile(loadedZone);
    m_ZoneInfoBox.x = gApp.screen.width - m_ZoneInfoBox.width - 12;
    m_ZoneInfoBox.y = k_ScreenHeight - 173 - 12;
    gApp.stage.addChild(m_ZoneInfoBox);

  }

  CBattleState.prototype.HandleStart_orig = CBattleState.prototype.HandleStart;
  CBattleState.prototype.HandleStart = function (delta) {
    this.HandleStart_orig(delta);

    if (this.m_bRunning) {
      const ptPerSec = (this.m_rtBattleEnd - this.m_rtBattleStart) / 1000.0;
      this.m_Score = this.m_ScoreIncrements * ptPerSec;
      this.m_ScoreIncrements = 0;
    }
  };

  CBattleState.prototype.RenderVictoryScreen_orig = CBattleState.prototype.RenderVictoryScreen;
  CBattleState.prototype.RenderVictoryScreen = function (result) {
    this.RenderVictoryScreen_orig(result);

    waitForResponse(() => gGame.ChangeState(new CBattleSelectionState(this.m_PlanetData.id)));
  };

  CSalienInfoBox.prototype.SetLevel_orig = CSalienInfoBox.prototype.SetLevel;
  CSalienInfoBox.prototype.SetLevel = function (lvl) {
    this.SetLevel_orig(lvl);

    this.m_RemainingLabelText = new PIXI.Text('Remaining:'.toUpperCase());
    var smallLabelStyle = jQuery.extend({}, k_TextStyleBold);
    smallLabelStyle.align = "left";
    smallLabelStyle.fontSize = 12;
    this.m_RemainingLabelText.style = smallLabelStyle;
    this.m_RemainingLabelText.anchor.set(0.0, 0.0);
    this.m_RemainingLabelText.x = 2;
    this.m_RemainingLabelText.y = this.m_Height + 16;
    this.m_RemainingLabelText.tint = 0x000000;
    this.addChild(this.m_RemainingLabelText);

    const remaining = Math.round((gPlayerInfo.next_level_score - gPlayerInfo.score) / g_ScoreIncrements / 60);
    const remainingM = remaining % 60;
    const remainingH = (remaining - remainingM) / 60;
    this.m_RemainingValueText = new PIXI.Text(`${remainingH} h ${remainingM} min`);
    var xpStyle = jQuery.extend({}, k_TextStyleDefault);
    xpStyle.align = "left";
    xpStyle.fontSize = 12;
    this.m_RemainingValueText.style = xpStyle;
    this.m_RemainingValueText.anchor.set(0.0, 0.0);
    this.m_RemainingValueText.x = this.m_RemainingLabelText.x + this.m_RemainingLabelText.width + 4;
    this.m_RemainingValueText.y = this.m_Height + 16;
    this.m_RemainingValueText.tint = 0x000000;
    this.addChild(this.m_RemainingValueText);
  };
})();

function getZonePriority(z) {
  var group = "/r/saliens";
  var idx = z.top_clans.findIndex(function (c) {
    return c.name === group
  });
  if (z.boss) {
    z.priority = 100;
  } else {
    if (idx !== -1) {
      z.priority = 2 - idx / 5;
    } else {
      z.priority = -1;
    }
  }
  z.priority *= z.capture_progress;
  return z.priority;
};

function waitForResponse(cb) {
  if (ajaxPending) {
    setTimeout(() => waitForResponse(cb), 100);
  } else {
    cb();
  }
}

function CZoneInfoBox() {
  CUIBox.call(this);
  this.m_InfoBox = this;

  this.SetTitleStyle(k_TextStyleDefault);
  this.SetTitleTailPosition(this.GetWidth() + 2);

  this.m_InfoBoxUnclaimedContainer = new PIXI.Container();
  this.m_InfoBoxClaimedContainer = new PIXI.Container();

  this.m_InfoBoxProgress = new CProgressBar(102);
  this.m_InfoBoxProgress.x = 131;
  this.m_InfoBoxProgress.y = 51;

  this.m_InfoBoxProgressLabel = new PIXI.Text('Community Progress'.toUpperCase());
  this.m_InfoBoxProgressLabel.style = k_TextStyleSmallerBold;
  this.m_InfoBoxProgressLabel.anchor.set(0.5, 0);
  this.m_InfoBoxProgressLabel.x = this.m_InfoBoxProgress.x + this.m_InfoBoxProgress.m_Width / 2;
  this.m_InfoBoxProgressLabel.y = this.m_InfoBoxProgress.y - 17;

  this.m_InfoBoxThreatLevelLabel = new PIXI.Text('Threat level'.toUpperCase());
  this.m_InfoBoxThreatLevelLabel.style = k_TextStyleSmallBold;
  this.m_InfoBoxThreatLevelLabel.anchor.set(0.5, 0);
  this.m_InfoBoxThreatLevelLabel.x = 64;
  this.m_InfoBoxThreatLevelLabel.y = 22;

  this.m_InfoBoxThreatLevel = new PIXI.Text('Low'.toUpperCase());
  this.m_InfoBoxThreatLevel.style = k_TextStyleHugeBold;
  this.m_InfoBoxThreatLevel.anchor.set(0.5, 0);
  this.m_InfoBoxThreatLevel.x = 64;
  this.m_InfoBoxThreatLevel.y = 36;

  this.m_InfoBoxClanContainer = new PIXI.Container();

  this.m_InfoBoxUnclaimedContainer.addChild(this.m_InfoBoxThreatLevel);
  this.m_InfoBoxUnclaimedContainer.addChild(this.m_InfoBoxProgressLabel);
  this.m_InfoBoxUnclaimedContainer.addChild(this.m_InfoBoxProgress);
  this.m_InfoBoxUnclaimedContainer.addChild(this.m_InfoBoxThreatLevelLabel);

  this.m_InfoBoxWithHelpLabel = new PIXI.Text('With help from'.toUpperCase() + ":");
  this.m_InfoBoxWithHelpLabel.style = k_TextStyleSmallBoldLeft;
  this.m_InfoBoxWithHelpLabel.anchor.set(0, 0);
  this.m_InfoBoxWithHelpLabel.x = 64;
  this.m_InfoBoxWithHelpLabel.y = 22;

  this.m_InfoBoxPrimaryClan = null;
  this.m_InfoBoxSecondaryClans = null;

  this.m_InfoBoxClanContainer.addChild(this.m_InfoBoxWithHelpLabel);
}

CZoneInfoBox.prototype = Object.create(CUIBox.prototype);

CZoneInfoBox.prototype.SetTile = function (tileData) {
  if (tileData.captured) {
    this.removeChild(this.m_InfoBoxUnclaimedContainer);
    this.addChild(this.m_InfoBoxClaimedContainer);

    this.SetSize(186, 80);
    this.m_InfoBoxProgress.SetValue(1.0);
    this.SetTitleText('Claimed'.toUpperCase());

    this._RefreshInfoTeamImages(tileData);
  } else {
    this.removeChild(this.m_InfoBoxClaimedContainer);
    this.addChild(this.m_InfoBoxUnclaimedContainer);

    this.SetSize(260, 80);

    var progress = tileData.capture_progress;
    this.m_InfoBoxProgress.SetValue(progress);

    this.SetTitleText('Unclaimed'.toUpperCase());

    switch (tileData.difficulty) {
      case 3:
        {
          this.m_InfoBoxThreatLevel.text = 'High'.toUpperCase();
          this.m_InfoBoxThreatLevel.tint = 0xf07b13;
          break;
        }
      case 2:
        {
          this.m_InfoBoxThreatLevel.text = 'Medium'.toUpperCase();
          this.m_InfoBoxThreatLevel.tint = 0xe9d35a;
          break;
        }
      default:
        {
          this.m_InfoBoxThreatLevel.text = 'Low'.toUpperCase();
          this.m_InfoBoxThreatLevel.tint = 0x75e95a;
          break;
        }
    }

    this._RefreshInfoTeamImages(tileData);
  }
}

CZoneInfoBox.prototype._RefreshInfoTeamImages = CBattleSelect.prototype._RefreshInfoTeamImages;