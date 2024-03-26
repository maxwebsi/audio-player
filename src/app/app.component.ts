import {Component, OnInit} from '@angular/core';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatSlider, MatSliderThumb} from "@angular/material/slider";
import {DatePipe, DecimalPipe, NgOptimizedImage} from "@angular/common";
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow, MatHeaderRowDef, MatRow, MatRowDef,
  MatTable
} from "@angular/material/table";

type Track = {
  id: number
  author: string
  title: string
  album: string
  fileName: string
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatSlider, MatSliderThumb, DecimalPipe, DatePipe, MatTable, MatColumnDef, MatHeaderCell, MatHeaderCellDef, MatCell, MatCellDef, MatHeaderRow, MatHeaderRowDef, MatRow, MatRowDef, NgOptimizedImage],
  templateUrl: './app.component.html',
  styles: [],
})

export class AppComponent implements OnInit {
  album: string = ''
  author: string = ''
  title: string = ''
  bucketUrl: string = "https://bitforce-max-web-it.s3.eu-central-1.amazonaws.com/"
  coverUrl: string = ""
  players: HTMLAudioElement[] = []
  playlist: Track[] = []
  playlistIndex: number = 0
  trackId: number = 0
  trackIdNext: number | undefined
  isPlaying: boolean = false
  setPreload: boolean = false
  changingTrack: boolean = false
  repeat: boolean = false
  random: boolean = false
  displayedColumns: string[] = ['author', 'title', 'album']
  showQueue: boolean = true

  constructor(
    private matIconReg: MatIconRegistry
  ) {
    // I use this method for simulate API call
    fetch('/assets/playlist.json')
    .then(res => res.json())
    .then(json => {
      this.playlist = json
      this.loadSong()
    })
  }

  ngOnInit(): void {
    this.matIconReg.setDefaultFontSetClass('material-symbols-outlined')
  }

  loadSong(newTrackId?: number) {
    if (newTrackId === this.trackId) {
      this.players[this.trackId].play()
      .then(() => {
        this.isPlaying = true
      })
      return
    }

    if (newTrackId) {
      const newTrack: Track | undefined = this.playlist.find((track: Track) => track.id === newTrackId)
      if (newTrack) {
        this.playlistIndex = this.playlist.indexOf(newTrack)
      }
    }

    const trackData: Track = this.playlist[this.playlistIndex]
    this.trackId = trackData.id

    this.setSongData()
    this.players[this.trackId] = new Audio(`${this.bucketUrl}tracks/${trackData.fileName}.mp3`)
    this.players[this.trackId].onloadedmetadata = () => {
      for (const k in this.players) {
        if (Number(k) !== this.trackId) {
          this.deleteAudio(Number(k))
        }
      }

      this.playSong()
    }
  }

  playSong(newTrackId?: number) {
    let currentTrackId = this.trackId
    if (newTrackId) currentTrackId = newTrackId

    this.players[currentTrackId].play()
    .then(() => {
      this.isPlaying = true
      if (this.changingTrack && this.trackId && this.trackIdNext) {
        const currentVolume = this.players[this.trackId].volume
        let newVolume = currentVolume
        let newVolumeNext = 0
        const remainingTime = this.players[this.trackId].duration - this.players[this.trackId].currentTime

        const interval = setInterval(() => {
          newVolume = this.players[this.trackId].volume - (currentVolume / 80 * 8 / remainingTime)
          newVolumeNext = this.players[this.trackIdNext!]?.volume + (currentVolume / 80 * 8 / remainingTime)
          if (newVolume < 0) newVolume = 0
          if (newVolumeNext > 1) newVolumeNext = 1
          this.players[this.trackId].volume = newVolume
          this.players[this.trackIdNext!].volume = newVolumeNext

          if (newVolume === 0 && newVolumeNext === 1) {
            clearInterval(interval)
            this.deleteAudio(this.trackId)
            if (this.trackIdNext) this.trackId = this.trackIdNext
            const currentTrack = this.playlist.find((track) => track.id === this.trackId)
            if (currentTrack) this.playlistIndex = this.playlist.indexOf(currentTrack)
            this.setSongData()
            this.trackIdNext = undefined
            this.changingTrack = false
            this.setPreload = false
            // this.terminateFade()
          }
        }, 100)
      } else {
        for (const k in this.players) {
          if (Number(k) !== this.trackId) {
            this.deleteAudio(Number(k))
          }
        }
      }
    })

    this.players[currentTrackId].ontimeupdate = (e) => {
      // @ts-ignore
      if (e.target.duration - e.target.currentTime < 15 && !this.setPreload && !this.repeat
        && (!this.random && this.playlistIndex < this.playlist.length - 1)
        && !/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        let nextPlaylistIndex: number = this.playlistIndex + 1
        if (this.random) {
          nextPlaylistIndex = this.getRandomPlaylistIndex()
        }

        this.preloadNextTrack(nextPlaylistIndex)
        this.setPreload = true
      }

      // @ts-ignore
      if (parseInt(e.target.duration) - parseInt(e.target.currentTime) <= 8 && this.trackIdNext && !this.changingTrack) {
        this.changingTrack = true
        this.players[this.trackIdNext].volume = 0
        this.playSong(this.trackIdNext)
      }
    }

    this.players[currentTrackId].onended = () => {
      if (this.repeat) {
        this.players[currentTrackId].currentTime = 0
        this.players[currentTrackId].play()
        .then(() => {
          this.isPlaying = true
        })
      }

      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        this.nextSong()
      }
    }
  }

  pause() {
    this.players[this.trackId].pause()
    this.isPlaying = false
  }

  play() {
    if (this.trackId) {
      this.players[this.trackId].play()
      .then(() => {
        this.isPlaying = true
      })
    } else {
      this.loadSong()
    }
  }

  nextSong() {
    if (this.random) {
      this.playlistIndex = this.getRandomPlaylistIndex()
    } else {
      this.playlistIndex++
    }
    this.deleteAudio(this.trackId)
    this.loadSong()
  }

  prevSong() {
    this.playlistIndex--
    this.deleteAudio(this.trackId)
    this.loadSong()
  }

  mute() {
    this.players[this.trackId].muted = true
  }

  unMute() {
    this.players[this.trackId].muted = false
  }

  setTime(event: Event) {
    this.players[this.trackId].currentTime = Number((event.target as HTMLInputElement).value)
  }

  setVolume(event: Event) {
    const volValue = Number((event.target as HTMLInputElement).value)
    this.players[this.trackId].volume = volValue
    if (volValue === 0) {
      this.mute()
    } else {
      this.unMute()
    }
  }

  private preloadNextTrack(index: number) {
    const trackData = this.playlist[index]
    this.players[trackData.id] = new Audio(`${this.bucketUrl}tracks/${trackData.fileName}.mp3`)
    this.trackIdNext = trackData.id
  }

  private setSongData() {
    this.coverUrl = `${this.bucketUrl}covers/${this.playlist[this.playlistIndex].fileName}.jpg`
    this.album = this.playlist[this.playlistIndex].album
    this.author = this.playlist[this.playlistIndex].author
    this.title = this.playlist[this.playlistIndex].title
  }

  private deleteAudio(trackId: number) {
    this.players[trackId].pause()
    this.players[trackId].src = ""
    delete this.players[trackId]
  }

  private getRandomPlaylistIndex() {
    return Math.floor(Math.random() * (this.playlist.length - 1))
  }

  protected readonly Math = Math;
}
